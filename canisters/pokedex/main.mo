import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";

/// Pokedex Canister — Agent Type Registry (ICP mirror of JasmyChain Pokedex)
actor class Pokedex(init : { owner : Principal }) = this {

  public type BaseStats = {
    contextWindowSize : Nat;
    maxConcurrentTasks : Nat8;
    skillSlots : Nat8;
    speed : Nat8;
    accuracy : Nat8;
    endurance : Nat8;
    creativity : Nat8;
  };

  public type AgentType = {
    typeId : Nat8;
    typeName : Text;
    element : Text;
    description : Text;
    baseStats : BaseStats;
    totalMinted : Nat;
    totalActive : Nat;
    cyclesConsumed : Nat; // ICP-specific
    httpOutcallsMade : Nat; // ICP-specific
    canistersSpawned : Nat; // ICP-specific
  };

  stable var _owner : Principal = init.owner;
  stable var _typeEntries : [(Nat8, AgentType)] = [];
  stable var _typeCount : Nat8 = 0;

  var types = HashMap.HashMap<Nat8, AgentType>(16, Nat8.equal, func(n : Nat8) : Hash.Hash { Hash.hash(Nat8.toNat(n)) });

  system func preupgrade() { _typeEntries := Iter.toArray(types.entries()) };
  system func postupgrade() {
    types := HashMap.fromIter(_typeEntries.vals(), _typeEntries.size(), Nat8.equal, func(n : Nat8) : Hash.Hash { Hash.hash(Nat8.toNat(n)) });
    _typeEntries := [];
  };

  stable var _initialized : Bool = false;

  // Initialize 10 base types (can only be called once)
  public shared(msg) func initialize() : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (_initialized) { return #err("Already initialized") };
    _addType("FIRE",     "Fire",     "Trading/DeFi",        { contextWindowSize = 4096;  maxConcurrentTasks = 2; skillSlots = 2; speed = 90; accuracy = 60; endurance = 50; creativity = 70 });
    _addType("WATER",    "Water",    "Research/Data",        { contextWindowSize = 8192;  maxConcurrentTasks = 2; skillSlots = 2; speed = 50; accuracy = 90; endurance = 80; creativity = 60 });
    _addType("ELECTRIC", "Electric", "Bots/Automation",      { contextWindowSize = 4096;  maxConcurrentTasks = 3; skillSlots = 2; speed = 95; accuracy = 70; endurance = 40; creativity = 50 });
    _addType("PSYCHIC",  "Psychic",  "AI/LLM",              { contextWindowSize = 16384; maxConcurrentTasks = 2; skillSlots = 3; speed = 60; accuracy = 85; endurance = 55; creativity = 95 });
    _addType("EARTH",    "Earth",    "Infrastructure",       { contextWindowSize = 8192;  maxConcurrentTasks = 3; skillSlots = 2; speed = 40; accuracy = 75; endurance = 95; creativity = 40 });
    _addType("DARK",     "Dark",     "Security/Audit",       { contextWindowSize = 4096;  maxConcurrentTasks = 2; skillSlots = 2; speed = 70; accuracy = 95; endurance = 60; creativity = 50 });
    _addType("DRAGON",   "Dragon",   "Multi-chain",          { contextWindowSize = 8192;  maxConcurrentTasks = 4; skillSlots = 3; speed = 80; accuracy = 80; endurance = 70; creativity = 80 });
    _addType("GHOST",    "Ghost",    "Stealth/MEV",          { contextWindowSize = 4096;  maxConcurrentTasks = 2; skillSlots = 2; speed = 85; accuracy = 65; endurance = 45; creativity = 75 });
    _addType("STEEL",    "Steel",    "Smart Contracts",      { contextWindowSize = 8192;  maxConcurrentTasks = 2; skillSlots = 3; speed = 55; accuracy = 90; endurance = 90; creativity = 55 });
    _addType("NATURE",   "Nature",   "Content/Creative",     { contextWindowSize = 8192;  maxConcurrentTasks = 2; skillSlots = 2; speed = 65; accuracy = 70; endurance = 70; creativity = 90 });
    _initialized := true;
    #ok(());
  };

  public query func getType(typeId : Nat8) : async ?AgentType { types.get(typeId) };

  public query func getAllTypes() : async [AgentType] {
    Iter.toArray(Iter.map<(Nat8, AgentType), AgentType>(types.entries(), func((_, t)) { t }));
  };

  public query func getTypeCount() : async Nat8 { _typeCount };

  public shared(msg) func addType(element : Text, name : Text, description : Text, baseStats : BaseStats) : async Result.Result<Nat8, Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (_typeCount >= 255) { return #err("Max 255 types reached") };
    _addType(element, name, description, baseStats);
    #ok(_typeCount - 1);
  };

  public shared(msg) func updateStats(typeId : Nat8, field : Text, value : Nat) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    switch (types.get(typeId)) {
      case (?t) {
        let updated = switch (field) {
          case "totalMinted"     { { t with totalMinted = value } };
          case "totalActive"     { { t with totalActive = value } };
          case "cyclesConsumed"  { { t with cyclesConsumed = value } };
          case "httpOutcalls"    { { t with httpOutcallsMade = value } };
          case "canistersSpawned" { { t with canistersSpawned = value } };
          case _ { t };
        };
        types.put(typeId, updated);
        #ok(());
      };
      case null { #err("Type not found") };
    };
  };

  func _addType(element : Text, name : Text, description : Text, baseStats : BaseStats) {
    let typeId = _typeCount;
    types.put(typeId, {
      typeId;
      typeName = name;
      element;
      description;
      baseStats;
      totalMinted = 0;
      totalActive = 0;
      cyclesConsumed = 0;
      httpOutcallsMade = 0;
      canistersSpawned = 0;
    });
    _typeCount += 1;
  };
};
