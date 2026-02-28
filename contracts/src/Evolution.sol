// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IAgentNFT {
    struct AgentData {
        uint8 element;
        uint8 evolutionStage;
        uint16 level;
        uint64 xp;
        bool isShiny;
        bool isMythic;
        bool isGenesis;
        uint16 parentA;
        uint16 parentB;
        uint8 breedCount;
        uint64 mintedAt;
    }

    function getAgent(uint256 tokenId) external view returns (AgentData memory);
    function ownerOf(uint256 tokenId) external view returns (address);
    function addAgentXP(uint256 tokenId, uint64 amount, string calldata source) external;
    function setAgentLevel(uint256 tokenId, uint16 newLevel) external;
    function setEvolutionStage(uint256 tokenId, uint8 newStage) external;
    function setTokenURI(uint256 tokenId, string calldata _tokenURI) external;
}

/**
 * @title Evolution
 * @notice XP tracking and evolution engine for Agent NFTs
 * @dev Manages XP sources, level-ups, evolution triggers, and metadata updates
 */
contract Evolution is Ownable, ReentrancyGuard, Pausable {
    // ---------------------------------------------------------------
    // STATE
    // ---------------------------------------------------------------

    IAgentNFT public agentNFT;

    // XP thresholds for each evolution stage
    // EGG->BABY: hatch (first plug-in), BABY->JUVENILE: 100, JUVENILE->ADULT: 500, etc.
    uint64[6] public evolutionXPThresholds = [0, 0, 100, 500, 2000, 5000];

    // XP per level (cumulative XP needed to reach level N)
    uint16 public xpPerLevel = 10;

    // XP rewards by source
    mapping(string => uint64) public xpRewards;

    // Authorized XP reporters (oracles, game contracts, etc.)
    mapping(address => bool) public authorizedReporters;

    // Metadata URI generator/service endpoint
    string public metadataServiceURI;

    // ---------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------

    event Evolved(uint256 indexed tokenId, uint8 fromStage, uint8 toStage, uint16 newLevel);
    event Hatched(uint256 indexed tokenId, address indexed owner);
    event LevelUp(uint256 indexed tokenId, uint16 fromLevel, uint16 toLevel);
    event XPAwarded(uint256 indexed tokenId, uint64 amount, string source, address reporter);
    event ThresholdUpdated(uint8 stage, uint64 newThreshold);
    event ReporterUpdated(address indexed reporter, bool authorized);

    // ---------------------------------------------------------------
    // MODIFIERS
    // ---------------------------------------------------------------

    modifier onlyReporter() {
        require(authorizedReporters[msg.sender] || msg.sender == owner(), "Not authorized reporter");
        _;
    }

    // ---------------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------------

    constructor(address _agentNFT) Ownable(msg.sender) {
        require(_agentNFT != address(0), "Invalid AgentNFT");
        agentNFT = IAgentNFT(_agentNFT);

        // Default XP rewards
        xpRewards["task_completed"] = 10;
        xpRewards["revenue_per_dollar"] = 1;
        xpRewards["uptime_hour"] = 1;
        xpRewards["battle_win"] = 25;
        xpRewards["battle_loss"] = 5;
        xpRewards["cross_chain_op"] = 15;
        xpRewards["tool_call"] = 2;
        xpRewards["agent_served"] = 5;
    }

    // ---------------------------------------------------------------
    // HATCH (EGG -> BABY)
    // ---------------------------------------------------------------

    function hatch(uint256 tokenId) external nonReentrant whenNotPaused {
        require(agentNFT.ownerOf(tokenId) == msg.sender, "Not owner");
        IAgentNFT.AgentData memory agent = agentNFT.getAgent(tokenId);
        require(agent.evolutionStage == 0, "Not an egg");

        agentNFT.setEvolutionStage(tokenId, 1);
        agentNFT.setAgentLevel(tokenId, 1);

        emit Hatched(tokenId, msg.sender);
        emit Evolved(tokenId, 0, 1, 1);
    }

    // ---------------------------------------------------------------
    // XP & LEVELING
    // ---------------------------------------------------------------

    function awardXP(uint256 tokenId, string calldata source, uint64 multiplier) external onlyReporter whenNotPaused {
        uint64 baseXP = xpRewards[source];
        require(baseXP > 0, "Unknown XP source");

        uint64 amount = baseXP * (multiplier > 0 ? multiplier : 1);
        agentNFT.addAgentXP(tokenId, amount, source);

        // Check for level-ups
        IAgentNFT.AgentData memory agent = agentNFT.getAgent(tokenId);
        uint16 newLevel = _calculateLevel(agent.xp);

        if (newLevel > agent.level) {
            agentNFT.setAgentLevel(tokenId, newLevel);
            emit LevelUp(tokenId, agent.level, newLevel);
        }

        emit XPAwarded(tokenId, amount, source, msg.sender);
    }

    function awardCustomXP(uint256 tokenId, uint64 amount, string calldata source) external onlyReporter whenNotPaused {
        agentNFT.addAgentXP(tokenId, amount, source);

        IAgentNFT.AgentData memory agent = agentNFT.getAgent(tokenId);
        uint16 newLevel = _calculateLevel(agent.xp);

        if (newLevel > agent.level) {
            agentNFT.setAgentLevel(tokenId, newLevel);
            emit LevelUp(tokenId, agent.level, newLevel);
        }

        emit XPAwarded(tokenId, amount, source, msg.sender);
    }

    // ---------------------------------------------------------------
    // EVOLUTION
    // ---------------------------------------------------------------

    function evolve(uint256 tokenId) external nonReentrant whenNotPaused {
        require(agentNFT.ownerOf(tokenId) == msg.sender, "Not owner");

        IAgentNFT.AgentData memory agent = agentNFT.getAgent(tokenId);
        require(agent.evolutionStage > 0, "Must hatch first");
        require(agent.evolutionStage < 5, "Already at APEX");

        uint8 nextStage = agent.evolutionStage + 1;
        require(agent.xp >= evolutionXPThresholds[nextStage], "Insufficient XP");

        agentNFT.setEvolutionStage(tokenId, nextStage);

        emit Evolved(tokenId, agent.evolutionStage, nextStage, agent.level);
    }

    function canEvolve(uint256 tokenId) external view returns (bool, uint8 nextStage, uint64 xpNeeded) {
        IAgentNFT.AgentData memory agent = agentNFT.getAgent(tokenId);

        if (agent.evolutionStage == 0 || agent.evolutionStage >= 5) {
            return (false, 0, 0);
        }

        nextStage = agent.evolutionStage + 1;
        uint64 threshold = evolutionXPThresholds[nextStage];

        if (agent.xp >= threshold) {
            return (true, nextStage, 0);
        }

        return (false, nextStage, threshold - agent.xp);
    }

    // ---------------------------------------------------------------
    // INTERNAL
    // ---------------------------------------------------------------

    function _calculateLevel(uint64 xp) internal view returns (uint16) {
        if (xp == 0) return 0;
        uint16 level = uint16(xp / xpPerLevel);
        if (level > 100) level = 100;
        if (level == 0) level = 1;
        return level;
    }

    // ---------------------------------------------------------------
    // OWNER SETTERS — PAISLEY RULE
    // ---------------------------------------------------------------

    function setAgentNFT(address _agentNFT) external onlyOwner {
        require(_agentNFT != address(0), "Invalid address");
        agentNFT = IAgentNFT(_agentNFT);
    }

    function setEvolutionThreshold(uint8 stage, uint64 threshold) external onlyOwner {
        require(stage > 0 && stage <= 5, "Invalid stage");
        evolutionXPThresholds[stage] = threshold;
        emit ThresholdUpdated(stage, threshold);
    }

    function setXPPerLevel(uint16 _xpPerLevel) external onlyOwner {
        require(_xpPerLevel > 0, "Must be > 0");
        xpPerLevel = _xpPerLevel;
    }

    function setXPReward(string calldata source, uint64 amount) external onlyOwner {
        xpRewards[source] = amount;
    }

    function setAuthorizedReporter(address reporter, bool authorized) external onlyOwner {
        authorizedReporters[reporter] = authorized;
        emit ReporterUpdated(reporter, authorized);
    }

    function setMetadataServiceURI(string calldata _uri) external onlyOwner {
        metadataServiceURI = _uri;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function rescueETH(address to) external onlyOwner {
        (bool sent, ) = to.call{value: address(this).balance}("");
        require(sent, "Rescue failed");
    }
}
