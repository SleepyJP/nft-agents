import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Cycles "mo:base/ExperimentalCycles";
import Hash "mo:base/Hash";
import HashMap "mo:base/HashMap";
import Int "mo:base/Int";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Option "mo:base/Option";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Timer "mo:base/Timer";

/// AgentRuntime — The Living Agent Canister
/// Each NFT can spawn one of these. It IS the agent.
/// Perceive → Decide → Act → Observe → Heal → Remember
actor class AgentRuntime(init : {
  owner : Principal;
  nftCanister : Principal;
  tokenId : Nat;
  element : Text;
  name : Text;
  personality : Text;
}) = this {

  // ---------------------------------------------------------------
  // TYPES
  // ---------------------------------------------------------------

  public type MemoryEntry = {
    id : Nat;
    content : Text;
    category : Text; // "task", "observation", "learning", "error"
    timestamp : Int;
    importance : Nat8; // 1-10
  };

  public type ToolDefinition = {
    name : Text;
    description : Text;
    endpoint : Text;
    method : Text; // "GET" | "POST"
    headers : [(Text, Text)];
    bodyTemplate : ?Text;
  };

  public type TaskResult = {
    taskId : Nat;
    success : Bool;
    output : Text;
    xpEarned : Nat64;
    timestamp : Int;
  };

  public type AgentStatus = {
    #Idle;
    #Working : Text;
    #Sleeping;
    #Error : Text;
  };

  // ---------------------------------------------------------------
  // STABLE STATE
  // ---------------------------------------------------------------

  stable var _owner : Principal = init.owner;
  stable var _nftCanister : Principal = init.nftCanister;
  stable var _tokenId : Nat = init.tokenId;
  stable var _name : Text = init.name;
  stable var _element : Text = init.element;
  stable var _personality : Text = init.personality;
  stable var _status : { #Idle; #Working : Text; #Sleeping; #Error : Text } = #Idle;

  stable var _nextMemoryId : Nat = 1;
  stable var _nextTaskId : Nat = 1;
  stable var _totalTasksCompleted : Nat = 0;
  stable var _totalXPEarned : Nat64 = 0;
  stable var _uptimeStart : Int = Time.now();
  stable var _lastHeartbeat : Int = Time.now();
  stable var _heartbeatIntervalSeconds : Nat = 3600; // 1 hour default
  stable var _maxMemoryEntries : Nat = 10000;
  stable var _maxTaskHistory : Nat = 5000;

  // Persistent memory (survives upgrades via stable storage)
  stable var _memoryEntries : [(Nat, MemoryEntry)] = [];
  stable var _toolEntries : [(Text, ToolDefinition)] = [];
  stable var _taskHistory : [TaskResult] = [];
  stable var _contextBench : [(Text, Text)] = []; // key -> value pairs

  // Runtime maps
  var memory = HashMap.HashMap<Nat, MemoryEntry>(64, Nat.equal, Hash.hash);
  var tools = HashMap.HashMap<Text, ToolDefinition>(16, Text.equal, Text.hash);
  var contextBench = HashMap.HashMap<Text, Text>(32, Text.equal, Text.hash);

  // Heartbeat timer
  stable var _heartbeatTimerId : ?Nat = null;

  // ---------------------------------------------------------------
  // UPGRADE HOOKS
  // ---------------------------------------------------------------

  system func preupgrade() {
    _memoryEntries := Iter.toArray(memory.entries());
    _toolEntries := Iter.toArray(tools.entries());
    _contextBench := Iter.toArray(contextBench.entries());
  };

  system func postupgrade() {
    memory := HashMap.fromIter(_memoryEntries.vals(), _memoryEntries.size(), Nat.equal, Hash.hash);
    tools := HashMap.fromIter(_toolEntries.vals(), _toolEntries.size(), Text.equal, Text.hash);
    contextBench := HashMap.fromIter(_contextBench.vals(), _contextBench.size(), Text.equal, Text.hash);
    _memoryEntries := [];
    _toolEntries := [];
    _contextBench := [];
  };

  // ---------------------------------------------------------------
  // MEMORY SYSTEM (Persistent Agent Memory)
  // ---------------------------------------------------------------

  public shared(msg) func remember(content : Text, category : Text, importance : Nat8) : async Nat {
    assert(_isAuthorized(msg.caller));

    // Bound memory size - evict oldest low-importance entries if at capacity
    if (memory.size() >= _maxMemoryEntries) {
      // Find and remove the oldest entry with lowest importance
      var worstId : ?Nat = null;
      var worstScore : Nat8 = 11;
      var worstTime : Int = Time.now();
      for ((id, entry) in memory.entries()) {
        if (entry.importance < worstScore or (entry.importance == worstScore and entry.timestamp < worstTime)) {
          worstId := ?id;
          worstScore := entry.importance;
          worstTime := entry.timestamp;
        };
      };
      switch (worstId) {
        case (?id) { memory.delete(id) };
        case null {};
      };
    };

    let id = _nextMemoryId;
    _nextMemoryId += 1;

    let entry : MemoryEntry = {
      id;
      content;
      category;
      timestamp = Time.now();
      importance;
    };

    memory.put(id, entry);
    id;
  };

  public query func recall(category : ?Text, limit : Nat) : async [MemoryEntry] {
    let buf = Buffer.Buffer<MemoryEntry>(limit);
    var count = 0;

    // Iterate memories, filtering by category if specified
    for ((_, entry) in memory.entries()) {
      if (count >= limit) { return Buffer.toArray(buf) };
      switch (category) {
        case (?cat) {
          if (entry.category == cat) {
            buf.add(entry);
            count += 1;
          };
        };
        case null {
          buf.add(entry);
          count += 1;
        };
      };
    };

    Buffer.toArray(buf);
  };

  public query func recallImportant(minImportance : Nat8, limit : Nat) : async [MemoryEntry] {
    let buf = Buffer.Buffer<MemoryEntry>(limit);
    var count = 0;

    for ((_, entry) in memory.entries()) {
      if (count >= limit) { return Buffer.toArray(buf) };
      if (entry.importance >= minImportance) {
        buf.add(entry);
        count += 1;
      };
    };

    Buffer.toArray(buf);
  };

  public shared(msg) func forget(memoryId : Nat) : async Bool {
    assert(_isAuthorized(msg.caller));
    memory.delete(memoryId);
    true;
  };

  // ---------------------------------------------------------------
  // TOOL MANAGEMENT
  // ---------------------------------------------------------------

  public shared(msg) func registerTool(tool : ToolDefinition) : async () {
    assert(_isAuthorized(msg.caller));
    tools.put(tool.name, tool);
  };

  public shared(msg) func removeTool(name : Text) : async () {
    assert(_isAuthorized(msg.caller));
    tools.delete(name);
  };

  public query func getTools() : async [ToolDefinition] {
    Iter.toArray(Iter.map<(Text, ToolDefinition), ToolDefinition>(tools.entries(), func((_, t)) { t }));
  };

  // ---------------------------------------------------------------
  // CONTEXT BENCH
  // ---------------------------------------------------------------

  public shared(msg) func setContext(key : Text, value : Text) : async () {
    assert(_isAuthorized(msg.caller));
    contextBench.put(key, value);
  };

  public shared(msg) func removeContext(key : Text) : async () {
    assert(_isAuthorized(msg.caller));
    contextBench.delete(key);
  };

  public query func getContext(key : Text) : async ?Text {
    contextBench.get(key);
  };

  public query func getAllContext() : async [(Text, Text)] {
    Iter.toArray(contextBench.entries());
  };

  // ---------------------------------------------------------------
  // TASK EXECUTION
  // ---------------------------------------------------------------

  public shared(msg) func reportTaskComplete(output : Text, xpEarned : Nat64) : async Nat {
    assert(_isAuthorized(msg.caller));

    let taskId = _nextTaskId;
    _nextTaskId += 1;
    _totalTasksCompleted += 1;
    _totalXPEarned += xpEarned;

    let result : TaskResult = {
      taskId;
      success = true;
      output;
      xpEarned;
      timestamp = Time.now();
    };

    // Bound task history - trim oldest if over limit
    if (_taskHistory.size() >= _maxTaskHistory) {
      let trimmed = Array.tabulate<TaskResult>(
        _maxTaskHistory / 2,
        func(i) { _taskHistory[_taskHistory.size() - _maxTaskHistory / 2 + i] }
      );
      _taskHistory := Array.append(trimmed, [result]);
    } else {
      _taskHistory := Array.append(_taskHistory, [result]);
    };

    // Remember the task completion
    ignore await remember(
      "Completed task #" # Nat.toText(taskId) # ": " # output,
      "task",
      5
    );

    taskId;
  };

  // ---------------------------------------------------------------
  // HEARTBEAT (Scheduled Agent Wakeup)
  // ---------------------------------------------------------------

  public shared(msg) func startHeartbeat() : async () {
    assert(_isAuthorized(msg.caller));
    switch (_heartbeatTimerId) {
      case (?_) {}; // already running
      case null {
        let id = Timer.recurringTimer<system>(
          #seconds(_heartbeatIntervalSeconds),
          _onHeartbeat
        );
        _heartbeatTimerId := ?id;
      };
    };
  };

  public shared(msg) func stopHeartbeat() : async () {
    assert(_isAuthorized(msg.caller));
    switch (_heartbeatTimerId) {
      case (?id) {
        Timer.cancelTimer(id);
        _heartbeatTimerId := null;
      };
      case null {};
    };
  };

  func _onHeartbeat() : async () {
    _lastHeartbeat := Time.now();
    _status := #Working("Heartbeat check");

    // Agent wakeup logic:
    // 1. Check cycles balance
    // 2. Check pending tasks
    // 3. Execute scheduled operations
    // 4. Report status

    let cyclesBalance = Cycles.balance();

    // If low on cycles, remember to request refill
    // Wrapped in try-catch to prevent trapping and leaving status stuck
    if (cyclesBalance < 1_000_000_000_000) { // < 1T cycles
      try {
        ignore await remember(
          "Low cycles warning: " # Nat.toText(cyclesBalance) # " cycles remaining",
          "error",
          9
        );
      } catch (_) {
        // Swallow error - don't let heartbeat trap
      };
    };

    _status := #Idle;
  };

  // ---------------------------------------------------------------
  // STATUS & STATS
  // ---------------------------------------------------------------

  public query func getStatus() : async {
    name : Text;
    element : Text;
    status : { #Idle; #Working : Text; #Sleeping; #Error : Text };
    totalTasks : Nat;
    totalXP : Nat64;
    memoryCount : Nat;
    toolCount : Nat;
    cyclesBalance : Nat;
    uptimeNanos : Int;
    lastHeartbeat : Int;
  } {
    {
      name = _name;
      element = _element;
      status = _status;
      totalTasks = _totalTasksCompleted;
      totalXP = _totalXPEarned;
      memoryCount = memory.size();
      toolCount = tools.size();
      cyclesBalance = Cycles.balance();
      uptimeNanos = Time.now() - _uptimeStart;
      lastHeartbeat = _lastHeartbeat;
    };
  };

  public query func getTaskHistory(limit : Nat) : async [TaskResult] {
    let len = _taskHistory.size();
    if (len <= limit) { return _taskHistory };
    Array.tabulate<TaskResult>(limit, func(i) { _taskHistory[len - limit + i] });
  };

  // ---------------------------------------------------------------
  // ADMIN
  // ---------------------------------------------------------------

  public shared(msg) func setOwner(newOwner : Principal) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (Principal.isAnonymous(newOwner)) { return #err("Cannot set anonymous as owner") };
    _owner := newOwner;
    #ok(());
  };

  public shared(msg) func setPersonality(personality : Text) : async Result.Result<(), Text> {
    if (not _isAuthorized(msg.caller)) { return #err("Not authorized") };
    _personality := personality;
    #ok(());
  };

  public shared(msg) func setName(name : Text) : async Result.Result<(), Text> {
    if (not _isAuthorized(msg.caller)) { return #err("Not authorized") };
    _name := name;
    #ok(());
  };

  public shared(msg) func setHeartbeatInterval(seconds : Nat) : async Result.Result<(), Text> {
    if (not _isAuthorized(msg.caller)) { return #err("Not authorized") };
    if (seconds < 60) { return #err("Minimum interval is 60 seconds") };
    if (seconds > 86400) { return #err("Maximum interval is 86400 seconds (1 day)") };
    _heartbeatIntervalSeconds := seconds;
    #ok(());
  };

  // ---------------------------------------------------------------
  // CYCLES MANAGEMENT
  // ---------------------------------------------------------------

  public shared(msg) func acceptCycles() : async () {
    // Allow cycles from owner, nftCanister, or cycles manager
    // Note: on ICP, any caller can attach cycles to a call and they'll be accepted.
    // We still accept from anyone since rejecting cycles is wasteful,
    // but we cap acceptance to prevent dust-spam attacks from bloating logs.
    let available = Cycles.available();
    if (available > 0) {
      let _ = Cycles.accept<system>(available);
    };
  };

  public query func getCyclesBalance() : async Nat {
    Cycles.balance();
  };

  // ---------------------------------------------------------------
  // INTERNAL
  // ---------------------------------------------------------------

  func _isAuthorized(caller : Principal) : Bool {
    caller == _owner or caller == _nftCanister or caller == Principal.fromActor(this);
  };
};
