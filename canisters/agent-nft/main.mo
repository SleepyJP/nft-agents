import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Hash "mo:base/Hash";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Nat16 "mo:base/Nat16";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Option "mo:base/Option";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import TrieMap "mo:base/TrieMap";

/// AgentNFT Canister — ICRC-7 NFT + Agent Factory
/// Each minted NFT can optionally spawn a child agent canister
actor class AgentNFT(init : { owner : Principal; treasury : Principal }) = this {

  // ---------------------------------------------------------------
  // TYPES
  // ---------------------------------------------------------------

  public type TokenId = Nat;
  public type Element = { #Fire; #Water; #Electric; #Psychic; #Earth; #Dark; #Dragon; #Ghost; #Steel; #Nature };
  public type EvolutionStage = { #Egg; #Baby; #Juvenile; #Adult; #Alpha; #Apex };
  public type Rarity = { #Common; #Rare; #Legendary; #Shiny; #Mythic; #Genesis };

  public type AgentData = {
    tokenId : TokenId;
    owner : Principal;
    element : Element;
    evolutionStage : EvolutionStage;
    level : Nat16;
    xp : Nat64;
    isShiny : Bool;
    isMythic : Bool;
    isGenesis : Bool;
    parentA : ?TokenId;
    parentB : ?TokenId;
    breedCount : Nat8;
    mintedAt : Int;
    canisterId : ?Principal; // spawned agent canister
    metadataUri : Text;
    name : Text;
  };

  public type Metadata = {
    name : Text;
    description : Text;
    image : Text;
    attributes : [(Text, Text)];
  };

  // ---------------------------------------------------------------
  // STABLE STATE
  // ---------------------------------------------------------------

  stable var _owner : Principal = init.owner;
  stable var _treasury : Principal = init.treasury;
  stable var _nextTokenId : Nat = 1;
  stable var _name : Text = "NFT Agents";
  stable var _symbol : Text = "AGENT";
  stable var _description : Text = "Pokemon-style AI Agent NFTs on ICP";
  stable var _maxSupply : Nat = 10000;
  stable var _genesisSupply : Nat = 1000;
  stable var _totalSupply : Nat = 0;

  // Stable storage for upgrade persistence
  stable var _agentsEntries : [(TokenId, AgentData)] = [];
  stable var _ownedTokensEntries : [(Principal, [TokenId])] = [];
  stable var _approvalsEntries : [(TokenId, Principal)] = [];
  stable var _operatorApprovalsEntries : [(Principal, [Principal])] = [];

  // Runtime maps (rebuilt from stable on upgrade)
  var agents = HashMap.HashMap<TokenId, AgentData>(32, Nat.equal, Hash.hash);
  var ownedTokens = HashMap.HashMap<Principal, Buffer.Buffer<TokenId>>(32, Principal.equal, Principal.hash);
  var approvals = HashMap.HashMap<TokenId, Principal>(32, Nat.equal, Hash.hash);
  var operatorApprovals = HashMap.HashMap<Principal, Buffer.Buffer<Principal>>(32, Principal.equal, Principal.hash);

  // Authorized operators (evolution, battle, breeding contracts)
  stable var _authorizedOperators : [Principal] = [];

  // Track starter claims (one per wallet)
  stable var _starterClaimedEntries : [(Principal, Bool)] = [];
  var starterClaimed = HashMap.HashMap<Principal, Bool>(32, Principal.equal, Principal.hash);

  // ---------------------------------------------------------------
  // UPGRADE HOOKS
  // ---------------------------------------------------------------

  system func preupgrade() {
    _agentsEntries := Iter.toArray(agents.entries());
    _ownedTokensEntries := Iter.toArray(
      Iter.map<(Principal, Buffer.Buffer<TokenId>), (Principal, [TokenId])>(
        ownedTokens.entries(),
        func((p, buf)) { (p, Buffer.toArray(buf)) }
      )
    );
    _approvalsEntries := Iter.toArray(approvals.entries());
    _operatorApprovalsEntries := Iter.toArray(
      Iter.map<(Principal, Buffer.Buffer<Principal>), (Principal, [Principal])>(
        operatorApprovals.entries(),
        func((p, buf)) { (p, Buffer.toArray(buf)) }
      )
    );
    _starterClaimedEntries := Iter.toArray(starterClaimed.entries());
  };

  system func postupgrade() {
    agents := HashMap.fromIter<TokenId, AgentData>(_agentsEntries.vals(), _agentsEntries.size(), Nat.equal, Hash.hash);
    for ((p, tokens) in _ownedTokensEntries.vals()) {
      let buf = Buffer.Buffer<TokenId>(tokens.size());
      for (t in tokens.vals()) { buf.add(t) };
      ownedTokens.put(p, buf);
    };
    approvals := HashMap.fromIter<TokenId, Principal>(_approvalsEntries.vals(), _approvalsEntries.size(), Nat.equal, Hash.hash);
    for ((p, ops) in _operatorApprovalsEntries.vals()) {
      let buf = Buffer.Buffer<Principal>(ops.size());
      for (o in ops.vals()) { buf.add(o) };
      operatorApprovals.put(p, buf);
    };
    starterClaimed := HashMap.fromIter<Principal, Bool>(_starterClaimedEntries.vals(), _starterClaimedEntries.size(), Principal.equal, Principal.hash);
    _agentsEntries := [];
    _ownedTokensEntries := [];
    _approvalsEntries := [];
    _operatorApprovalsEntries := [];
    _starterClaimedEntries := [];
  };

  // ---------------------------------------------------------------
  // ICRC-7 STANDARD QUERIES
  // ---------------------------------------------------------------

  public query func icrc7_name() : async Text { _name };
  public query func icrc7_symbol() : async Text { _symbol };
  public query func icrc7_description() : async ?Text { ?_description };
  public query func icrc7_total_supply() : async Nat { _totalSupply };
  public query func icrc7_supply_cap() : async ?Nat { ?_maxSupply };

  public query func icrc7_owner_of(tokenIds : [TokenId]) : async [?{ owner : Principal; subaccount : ?Blob }] {
    Array.map<TokenId, ?{ owner : Principal; subaccount : ?Blob }>(tokenIds, func(id) {
      switch (agents.get(id)) {
        case (?agent) { ?{ owner = agent.owner; subaccount = null } };
        case null { null };
      };
    });
  };

  public query func icrc7_balance_of(accounts : [{ owner : Principal; subaccount : ?Blob }]) : async [Nat] {
    Array.map<{ owner : Principal; subaccount : ?Blob }, Nat>(accounts, func(acc) {
      switch (ownedTokens.get(acc.owner)) {
        case (?buf) { buf.size() };
        case null { 0 };
      };
    });
  };

  public query func icrc7_tokens_of(account : { owner : Principal; subaccount : ?Blob }, prev : ?TokenId, take : ?Nat) : async [TokenId] {
    switch (ownedTokens.get(account.owner)) {
      case (?buf) {
        let tokens = Buffer.toArray(buf);
        let start = switch (prev) {
          case (?p) {
            var idx = 0;
            label findIdx for (t in tokens.vals()) {
              if (t == p) { break findIdx };
              idx += 1;
            };
            idx + 1;
          };
          case null { 0 };
        };
        let limit = switch (take) { case (?t) { t }; case null { tokens.size() } };
        let end = Nat.min(start + limit, tokens.size());
        if (start >= tokens.size()) { return [] };
        Array.tabulate<TokenId>(end - start, func(i) { tokens[start + i] });
      };
      case null { [] };
    };
  };

  // ---------------------------------------------------------------
  // ICRC-7 TRANSFER
  // ---------------------------------------------------------------

  public shared(msg) func icrc7_transfer(args : [{ from_subaccount : ?Blob; to : { owner : Principal; subaccount : ?Blob }; token_id : TokenId; memo : ?Blob; created_at_time : ?Nat64 }]) : async [?{ #Ok : Nat; #Err : { #Unauthorized; #NonExistingTokenId; #Other : Text } }] {
    Array.map(args, func(arg : { from_subaccount : ?Blob; to : { owner : Principal; subaccount : ?Blob }; token_id : TokenId; memo : ?Blob; created_at_time : ?Nat64 }) : ?{ #Ok : Nat; #Err : { #Unauthorized; #NonExistingTokenId; #Other : Text } } {
      switch (agents.get(arg.token_id)) {
        case (?agent) {
          if (agent.owner != msg.caller and not _isApprovedOrOperator(msg.caller, arg.token_id, agent.owner)) {
            return ?#Err(#Unauthorized);
          };
          _transfer(agent.owner, arg.to.owner, arg.token_id);
          ?#Ok(arg.token_id);
        };
        case null { ?#Err(#NonExistingTokenId) };
      };
    });
  };

  // ---------------------------------------------------------------
  // MINTING
  // ---------------------------------------------------------------

  public shared(msg) func mint(name : Text, element : Element) : async Result.Result<TokenId, Text> {
    if (Principal.isAnonymous(msg.caller)) { return #err("Anonymous caller not allowed") };
    if (_totalSupply >= _maxSupply) { return #err("Max supply reached") };

    let tokenId = _nextTokenId;
    _nextTokenId += 1;
    _totalSupply += 1;

    let isGenesis = tokenId <= _genesisSupply;

    let agent : AgentData = {
      tokenId;
      owner = msg.caller;
      element;
      evolutionStage = #Egg;
      level = 0;
      xp = 0;
      isShiny = false;
      isMythic = false;
      isGenesis;
      parentA = null;
      parentB = null;
      breedCount = 0;
      mintedAt = Time.now();
      canisterId = null;
      metadataUri = "";
      name;
    };

    agents.put(tokenId, agent);
    _addToOwned(msg.caller, tokenId);

    #ok(tokenId);
  };

  public shared(msg) func mintStarter(name : Text, starterChoice : Nat8) : async Result.Result<TokenId, Text> {
    if (Principal.isAnonymous(msg.caller)) { return #err("Anonymous caller not allowed") };
    if (starterChoice > 2) { return #err("Invalid starter: 0=Fire, 1=Water, 2=Electric") };

    // Enforce one starter per wallet
    switch (starterClaimed.get(msg.caller)) {
      case (?_) { return #err("Starter already claimed") };
      case null {};
    };

    let element : Element = switch (starterChoice) {
      case 0 { #Fire };
      case 1 { #Water };
      case 2 { #Electric };
      case _ { #Fire };
    };

    if (_totalSupply >= _maxSupply) { return #err("Max supply reached") };

    let tokenId = _nextTokenId;
    _nextTokenId += 1;
    _totalSupply += 1;

    let agent : AgentData = {
      tokenId;
      owner = msg.caller;
      element;
      evolutionStage = #Baby;
      level = 1;
      xp = 0;
      isShiny = false;
      isMythic = false;
      isGenesis = tokenId <= _genesisSupply;
      parentA = null;
      parentB = null;
      breedCount = 0;
      mintedAt = Time.now();
      canisterId = null;
      metadataUri = "";
      name;
    };

    agents.put(tokenId, agent);
    _addToOwned(msg.caller, tokenId);
    starterClaimed.put(msg.caller, true);

    #ok(tokenId);
  };

  // ---------------------------------------------------------------
  // AGENT DATA MUTATIONS (authorized operators only)
  // ---------------------------------------------------------------

  public shared(msg) func setXP(tokenId : TokenId, xp : Nat64) : async Result.Result<(), Text> {
    if (not _isAuthorized(msg.caller)) { return #err("Not authorized") };
    switch (agents.get(tokenId)) {
      case (?agent) {
        let updated = { agent with xp };
        agents.put(tokenId, updated);
        #ok(());
      };
      case null { #err("Token not found") };
    };
  };

  public shared(msg) func addXP(tokenId : TokenId, amount : Nat64) : async Result.Result<(), Text> {
    if (not _isAuthorized(msg.caller)) { return #err("Not authorized") };
    switch (agents.get(tokenId)) {
      case (?agent) {
        let updated = { agent with xp = agent.xp + amount };
        agents.put(tokenId, updated);
        #ok(());
      };
      case null { #err("Token not found") };
    };
  };

  public shared(msg) func setEvolutionStage(tokenId : TokenId, stage : EvolutionStage) : async Result.Result<(), Text> {
    if (not _isAuthorized(msg.caller)) { return #err("Not authorized") };
    switch (agents.get(tokenId)) {
      case (?agent) {
        let updated = { agent with evolutionStage = stage };
        agents.put(tokenId, updated);
        #ok(());
      };
      case null { #err("Token not found") };
    };
  };

  public shared(msg) func setLevel(tokenId : TokenId, level : Nat16) : async Result.Result<(), Text> {
    if (not _isAuthorized(msg.caller)) { return #err("Not authorized") };
    switch (agents.get(tokenId)) {
      case (?agent) {
        let updated = { agent with level };
        agents.put(tokenId, updated);
        #ok(());
      };
      case null { #err("Token not found") };
    };
  };

  public shared(msg) func setCanisterId(tokenId : TokenId, canisterId : Principal) : async Result.Result<(), Text> {
    if (not _isAuthorized(msg.caller)) { return #err("Not authorized") };
    switch (agents.get(tokenId)) {
      case (?agent) {
        let updated = { agent with canisterId = ?canisterId };
        agents.put(tokenId, updated);
        #ok(());
      };
      case null { #err("Token not found") };
    };
  };

  // ---------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------

  public query func getAgent(tokenId : TokenId) : async ?AgentData {
    agents.get(tokenId);
  };

  public query func getAgentsByOwner(owner : Principal) : async [AgentData] {
    switch (ownedTokens.get(owner)) {
      case (?buf) {
        let tokenIds = Buffer.toArray(buf);
        Array.mapFilter<TokenId, AgentData>(tokenIds, func(id) { agents.get(id) });
      };
      case null { [] };
    };
  };

  public query func totalSupply() : async Nat { _totalSupply };

  // ---------------------------------------------------------------
  // ADMIN
  // ---------------------------------------------------------------

  public shared(msg) func setOwner(newOwner : Principal) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (Principal.isAnonymous(newOwner)) { return #err("Cannot set anonymous as owner") };
    _owner := newOwner;
    #ok(());
  };

  public shared(msg) func setTreasury(newTreasury : Principal) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    _treasury := newTreasury;
    #ok(());
  };

  public shared(msg) func addAuthorizedOperator(operator : Principal) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (Principal.isAnonymous(operator)) { return #err("Cannot authorize anonymous") };
    // Prevent duplicates and bound the array
    if (_authorizedOperators.size() >= 50) { return #err("Max 50 operators") };
    for (op in _authorizedOperators.vals()) {
      if (op == operator) { return #err("Already authorized") };
    };
    _authorizedOperators := Array.append(_authorizedOperators, [operator]);
    #ok(());
  };

  public shared(msg) func removeAuthorizedOperator(operator : Principal) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    _authorizedOperators := Array.filter<Principal>(_authorizedOperators, func(p) { p != operator });
    #ok(());
  };

  // ---------------------------------------------------------------
  // INTERNAL
  // ---------------------------------------------------------------

  func _isAuthorized(caller : Principal) : Bool {
    if (caller == _owner) { return true };
    for (op in _authorizedOperators.vals()) {
      if (op == caller) { return true };
    };
    false;
  };

  func _isApprovedOrOperator(caller : Principal, tokenId : TokenId, tokenOwner : Principal) : Bool {
    switch (approvals.get(tokenId)) {
      case (?approved) { if (approved == caller) { return true } };
      case null {};
    };
    switch (operatorApprovals.get(tokenOwner)) {
      case (?ops) {
        for (op in ops.vals()) {
          if (op == caller) { return true };
        };
      };
      case null {};
    };
    false;
  };

  func _transfer(from : Principal, to : Principal, tokenId : TokenId) {
    switch (agents.get(tokenId)) {
      case (?agent) {
        let updated = { agent with owner = to };
        agents.put(tokenId, updated);
        _removeFromOwned(from, tokenId);
        _addToOwned(to, tokenId);
        approvals.delete(tokenId);
      };
      case null {};
    };
  };

  func _addToOwned(owner : Principal, tokenId : TokenId) {
    switch (ownedTokens.get(owner)) {
      case (?buf) { buf.add(tokenId) };
      case null {
        let buf = Buffer.Buffer<TokenId>(4);
        buf.add(tokenId);
        ownedTokens.put(owner, buf);
      };
    };
  };

  func _removeFromOwned(owner : Principal, tokenId : TokenId) {
    switch (ownedTokens.get(owner)) {
      case (?buf) {
        let filtered = Buffer.Buffer<TokenId>(buf.size());
        for (t in buf.vals()) {
          if (t != tokenId) { filtered.add(t) };
        };
        ownedTokens.put(owner, filtered);
      };
      case null {};
    };
  };
};
