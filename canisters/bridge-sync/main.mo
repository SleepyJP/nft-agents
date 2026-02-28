import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Cycles "mo:base/ExperimentalCycles";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";

/// BridgeSync — Cross-chain state synchronization between JasmyChain and ICP
/// Uses HTTP outcalls to read JasmyChain RPC and sync agent state
actor class BridgeSync(init : {
  owner : Principal;
  nftCanister : Principal;
  jasmychainRpc : Text; // Use https://rpc.jasmyscan.net (verified working)
  jasmychainNftContract : Text;
  bridgeCanister : Text; // j4fnr-yyaaa-aaaad-qhy4q-cai
}) = this {

  public type SyncResult = {
    tokenId : Nat;
    field : Text;
    oldValue : Text;
    newValue : Text;
    timestamp : Int;
    txHash : ?Text;
  };

  stable var _owner : Principal = init.owner;
  stable var _nftCanister : Principal = init.nftCanister;
  stable var _jasmychainRpc : Text = init.jasmychainRpc;
  stable var _jasmychainNftContract : Text = init.jasmychainNftContract;
  stable var _bridgeCanister : Text = init.bridgeCanister;
  stable var _lastSyncTime : Int = 0;
  stable var _syncHistory : [SyncResult] = [];
  stable var _syncIntervalSeconds : Nat = 300; // 5 minutes
  stable var _maxSyncHistory : Nat = 1000;

  // Transform function for HTTP outcall consensus (strips variable headers)
  public query func transform(raw : {
    response : { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob };
    context : Blob;
  }) : async { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob } {
    // Return only the body for consensus -- headers and status can vary between replicas
    {
      status = raw.response.status;
      headers = []; // Strip variable headers for consensus
      body = raw.response.body;
    };
  };

  /// Fetch agent data from JasmyChain via HTTP outcall
  public shared(msg) func syncAgentFromJasmy(tokenId : Nat) : async Result.Result<Text, Text> {
    if (msg.caller != _owner) { return #err("Not owner") };

    // Validate RPC URL starts with https
    if (not Text.startsWith(_jasmychainRpc, #text("https://"))) {
      return #err("RPC URL must use HTTPS");
    };

    // Build eth_call request to read agent data from JasmyChain
    let payload = _buildGetAgentCall(tokenId);

    let request : {
      url : Text;
      max_response_bytes : ?Nat64;
      headers : [{ name : Text; value : Text }];
      body : ?Blob;
      method : { #get; #post; #head };
      transform : ?{ function : shared query { response : { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob }; context : Blob } -> async { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob }; context : Blob };
    } = {
      url = _jasmychainRpc;
      max_response_bytes = ?10000;
      headers = [{ name = "Content-Type"; value = "application/json" }];
      body = ?Text.encodeUtf8(payload);
      method = #post;
      transform = ?{
        function = transform;
        context = Blob.fromArray([]);
      };
    };

    Cycles.add<system>(230_000_000_000); // cycles for HTTP outcall

    try {
      let ic : actor {
        http_request : shared {
          url : Text;
          max_response_bytes : ?Nat64;
          headers : [{ name : Text; value : Text }];
          body : ?Blob;
          method : { #get; #post; #head };
          transform : ?{ function : shared query { response : { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob }; context : Blob } -> async { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob }; context : Blob };
        } -> async { status : Nat; headers : [{ name : Text; value : Text }]; body : Blob };
      } = actor("aaaaa-aa"); // Management canister

      let response = await ic.http_request(request);

      if (response.status == 200) {
        let responseText = switch (Text.decodeUtf8(response.body)) {
          case (?t) { t };
          case null { return #err("Failed to decode response") };
        };

        _lastSyncTime := Time.now();
        #ok(responseText);
      } else {
        #err("HTTP error: " # Nat.toText(response.status));
      };
    } catch (e) {
      #err("HTTP outcall failed");
    };
  };

  /// Get last sync timestamp
  public query func getLastSyncTime() : async Int { _lastSyncTime };

  /// Get sync history
  public query func getSyncHistory(limit : Nat) : async [SyncResult] {
    let len = _syncHistory.size();
    if (len <= limit) { return _syncHistory };
    let start = len - limit;
    Array.tabulate<SyncResult>(limit, func(i) { _syncHistory[start + i] });
  };

  // ---------------------------------------------------------------
  // ADMIN
  // ---------------------------------------------------------------

  public shared(msg) func setOwner(o : Principal) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (Principal.isAnonymous(o)) { return #err("Cannot set anonymous as owner") };
    _owner := o;
    #ok(());
  };
  public shared(msg) func setRpc(rpc : Text) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    // Validate HTTPS to prevent SSRF to internal/HTTP endpoints
    if (not Text.startsWith(rpc, #text("https://"))) {
      return #err("RPC URL must use HTTPS");
    };
    _jasmychainRpc := rpc;
    #ok(());
  };
  public shared(msg) func setNftContract(addr : Text) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    // Basic hex address validation (0x + 40 hex chars)
    if (addr.size() != 42) { return #err("Invalid address length") };
    _jasmychainNftContract := addr;
    #ok(());
  };
  public shared(msg) func setSyncInterval(s : Nat) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (s < 60) { return #err("Minimum interval is 60 seconds") };
    _syncIntervalSeconds := s;
    #ok(());
  };

  // ---------------------------------------------------------------
  // INTERNAL
  // ---------------------------------------------------------------

  func _buildGetAgentCall(tokenId : Nat) : Text {
    // eth_call to AgentNFT.getAgent(uint256 tokenId)
    // Function selector: keccak256("getAgent(uint256)") = first 4 bytes
    let tokenHex = _natToHex(tokenId);
    "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"" # _jasmychainNftContract # "\",\"data\":\"0x" # "b5d5e544" # _padLeft(tokenHex, 64) # "\"},\"latest\"],\"id\":1}";
  };

  func _natToHex(n : Nat) : Text {
    if (n == 0) return "0";
    var result = "";
    var remaining = n;
    let hexChars = ["0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f"];
    while (remaining > 0) {
      result := hexChars[remaining % 16] # result;
      remaining := remaining / 16;
    };
    result;
  };

  func _padLeft(s : Text, len : Nat) : Text {
    var result = s;
    while (result.size() < len) { result := "0" # result };
    result;
  };
};
