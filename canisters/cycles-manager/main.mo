import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Cycles "mo:base/ExperimentalCycles";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Timer "mo:base/Timer";

/// CyclesManager — Auto-refill cycles for agent canisters
/// Monitors agent canister balances and tops them up when low
actor class CyclesManager(init : { owner : Principal }) = this {

  public type ManagedCanister = {
    canisterId : Principal;
    name : Text;
    minBalance : Nat;     // min cycles before refill
    refillAmount : Nat;   // amount to top up
    lastRefill : Int;
    totalRefilled : Nat;
    isActive : Bool;
  };

  stable var _owner : Principal = init.owner;
  stable var _canisterEntries : [(Principal, ManagedCanister)] = [];
  stable var _checkIntervalSeconds : Nat = 600; // 10 minutes
  stable var _timerId : ?Nat = null;

  var managed = HashMap.HashMap<Principal, ManagedCanister>(16, Principal.equal, Principal.hash);

  system func preupgrade() { _canisterEntries := Iter.toArray(managed.entries()) };
  system func postupgrade() {
    managed := HashMap.fromIter(_canisterEntries.vals(), _canisterEntries.size(), Principal.equal, Principal.hash);
    _canisterEntries := [];
  };

  /// Register an agent canister for cycle management
  public shared(msg) func registerCanister(
    canisterId : Principal,
    name : Text,
    minBalance : Nat,
    refillAmount : Nat
  ) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (managed.size() >= 100) { return #err("Max 100 managed canisters") };
    if (refillAmount > 10_000_000_000_000) { return #err("Refill amount too large (max 10T cycles)") };
    managed.put(canisterId, {
      canisterId;
      name;
      minBalance;
      refillAmount;
      lastRefill = 0;
      totalRefilled = 0;
      isActive = true;
    });
    #ok(());
  };

  /// Remove a canister from management
  public shared(msg) func unregisterCanister(canisterId : Principal) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    managed.delete(canisterId);
    #ok(());
  };

  /// Get all managed canisters
  public query func getManagedCanisters() : async [ManagedCanister] {
    Iter.toArray(Iter.map<(Principal, ManagedCanister), ManagedCanister>(managed.entries(), func((_, c)) { c }));
  };

  /// Check and refill a specific canister
  public shared(msg) func checkAndRefill(canisterId : Principal) : async Result.Result<Text, Text> {
    if (msg.caller != _owner and msg.caller != Principal.fromActor(this)) { return #err("Not authorized") };

    switch (managed.get(canisterId)) {
      case (?mc) {
        if (not mc.isActive) { return #err("Canister not active") };

        // Query the canister's cycle balance
        let balance = await _getCanisterBalance(canisterId);

        if (balance < mc.minBalance) {
          // Top up
          let myBalance = Cycles.balance();
          if (myBalance < mc.refillAmount + 1_000_000_000) {
            return #err("CyclesManager balance too low");
          };

          Cycles.add<system>(mc.refillAmount);
          let ic : actor {
            deposit_cycles : shared { canister_id : Principal } -> async ();
          } = actor("aaaaa-aa");

          await ic.deposit_cycles({ canister_id = canisterId });

          // Update record
          managed.put(canisterId, {
            mc with
            lastRefill = Time.now();
            totalRefilled = mc.totalRefilled + mc.refillAmount;
          });

          #ok("Refilled " # Nat.toText(mc.refillAmount) # " cycles to " # mc.name);
        } else {
          #ok("Balance OK: " # Nat.toText(balance));
        };
      };
      case null { #err("Canister not registered") };
    };
  };

  /// Start automatic monitoring
  public shared(msg) func startMonitoring() : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    switch (_timerId) {
      case (?_) { #err("Already monitoring") };
      case null {
        let id = Timer.recurringTimer<system>(#seconds(_checkIntervalSeconds), _checkAll);
        _timerId := ?id;
        #ok(());
      };
    };
  };

  /// Stop monitoring
  public shared(msg) func stopMonitoring() : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    switch (_timerId) {
      case (?id) { Timer.cancelTimer(id); _timerId := null; #ok(()) };
      case null { #err("Not monitoring") };
    };
  };

  /// Accept cycles (for funding this manager)
  public func acceptCycles() : async () {
    let available = Cycles.available();
    let _ = Cycles.accept<system>(available);
  };

  public query func getCyclesBalance() : async Nat { Cycles.balance() };

  // ---------------------------------------------------------------
  // ADMIN
  // ---------------------------------------------------------------

  public shared(msg) func setOwner(o : Principal) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (Principal.isAnonymous(o)) { return #err("Cannot set anonymous as owner") };
    _owner := o;
    #ok(());
  };
  public shared(msg) func setCheckInterval(s : Nat) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (s < 60) { return #err("Minimum interval is 60 seconds") };
    if (s > 86400) { return #err("Maximum interval is 86400 seconds") };
    _checkIntervalSeconds := s;
    #ok(());
  };
  public shared(msg) func setCanisterActive(canisterId : Principal, active : Bool) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    switch (managed.get(canisterId)) {
      case (?mc) { managed.put(canisterId, { mc with isActive = active }); #ok(()) };
      case null { #err("Canister not registered") };
    };
  };
  public shared(msg) func setCanisterLimits(canisterId : Principal, minBalance : Nat, refillAmount : Nat) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (refillAmount > 10_000_000_000_000) { return #err("Refill amount too large (max 10T cycles)") };
    switch (managed.get(canisterId)) {
      case (?mc) { managed.put(canisterId, { mc with minBalance; refillAmount }); #ok(()) };
      case null { #err("Canister not registered") };
    };
  };

  // ---------------------------------------------------------------
  // INTERNAL
  // ---------------------------------------------------------------

  func _checkAll() : async () {
    for ((canisterId, mc) in managed.entries()) {
      if (mc.isActive) {
        try {
          ignore await checkAndRefill(canisterId);
        } catch (_) {
          // Individual canister failure should not stop checking others
        };
      };
    };
  };

  func _getCanisterBalance(canisterId : Principal) : async Nat {
    let ic : actor {
      canister_status : shared { canister_id : Principal } -> async { cycles : Nat; status : { #running; #stopping; #stopped }; memory_size : Nat; settings : { controllers : [Principal] } };
    } = actor("aaaaa-aa");

    let status = await ic.canister_status({ canister_id = canisterId });
    status.cycles;
  };
};
