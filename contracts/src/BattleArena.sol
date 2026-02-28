// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IAgentNFTBattle {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getAgentLevel(uint256 tokenId) external view returns (uint16);
    function getEvolutionStage(uint256 tokenId) external view returns (uint8);
}

interface IEvolution {
    function awardCustomXP(uint256 tokenId, uint64 amount, string calldata source) external;
}

/**
 * @title BattleArena
 * @notice PvP battle system for Agent NFTs with escrow and leaderboards
 * @dev Supports multiple battle types, oracle reporting, XP distribution
 */
contract BattleArena is Ownable, ReentrancyGuard, Pausable {
    // ---------------------------------------------------------------
    // ENUMS & STRUCTS
    // ---------------------------------------------------------------

    enum BattleType { PNL, SPEED, ACCURACY, BUILD, ENDURANCE }
    enum BattleStatus { OPEN, ACTIVE, COMPLETED, CANCELLED }

    struct Battle {
        uint256 battleId;
        BattleType battleType;
        uint256 entryFee;
        uint256 challengerTokenId;
        uint256 opponentTokenId;
        address challenger;
        address opponent;
        BattleStatus status;
        uint256 winnerId;
        uint64 startTime;
        uint64 endTime;
        uint64 duration; // max duration in seconds
    }

    struct LeaderboardEntry {
        uint256 tokenId;
        uint32 wins;
        uint32 losses;
        uint32 currentStreak;
        uint32 bestStreak;
        uint16 highestLevelBeaten;
    }

    // ---------------------------------------------------------------
    // STATE
    // ---------------------------------------------------------------

    IAgentNFTBattle public agentNFT;
    IEvolution public evolution;
    address public treasury;
    address public oracle;

    uint256 public nextBattleId = 1;
    uint256 public platformFeeBps = 1000; // 10% of pot
    uint256 public constant MAX_FEE_BPS = 3000; // 30% ceiling

    uint64 public winXP = 25;
    uint64 public loseXP = 5;

    uint256 public minEntryFee = 1 ether;
    uint256 public maxEntryFee = 10000 ether;

    mapping(uint256 => Battle) public battles;
    mapping(uint256 => LeaderboardEntry) public leaderboard;

    // Active battle per token (token can only be in one battle)
    mapping(uint256 => uint256) public activeBattle;

    // Pull-pattern: claimable payouts for addresses that fail to receive ETH
    mapping(address => uint256) public pendingWithdrawals;

    // ---------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------

    event BattleCreated(uint256 indexed battleId, BattleType battleType, uint256 entryFee, uint256 challengerTokenId, address challenger);
    event BattleJoined(uint256 indexed battleId, uint256 opponentTokenId, address opponent);
    event BattleCompleted(uint256 indexed battleId, uint256 winnerId, uint256 loserId);
    event BattleCancelled(uint256 indexed battleId);
    event OracleUpdated(address indexed newOracle);

    // ---------------------------------------------------------------
    // MODIFIERS
    // ---------------------------------------------------------------

    modifier onlyOracle() {
        require(msg.sender == oracle || msg.sender == owner(), "Not oracle");
        _;
    }

    // ---------------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------------

    constructor(
        address _agentNFT,
        address _evolution,
        address _treasury,
        address _oracle
    ) Ownable(msg.sender) {
        require(_agentNFT != address(0) && _treasury != address(0), "Invalid address");
        agentNFT = IAgentNFTBattle(_agentNFT);
        evolution = IEvolution(_evolution);
        treasury = _treasury;
        oracle = _oracle;
    }

    // ---------------------------------------------------------------
    // BATTLE FLOW
    // ---------------------------------------------------------------

    function createBattle(
        BattleType battleType,
        uint256 challengerTokenId,
        uint64 duration
    ) external payable nonReentrant whenNotPaused {
        require(agentNFT.ownerOf(challengerTokenId) == msg.sender, "Not owner");
        require(agentNFT.getEvolutionStage(challengerTokenId) >= 1, "Must be hatched");
        require(msg.value >= minEntryFee && msg.value <= maxEntryFee, "Invalid entry fee");
        require(activeBattle[challengerTokenId] == 0, "Already in battle");
        require(duration >= 60 && duration <= 604800, "Duration 1min-7days");

        uint256 battleId = nextBattleId++;

        battles[battleId] = Battle({
            battleId: battleId,
            battleType: battleType,
            entryFee: msg.value,
            challengerTokenId: challengerTokenId,
            opponentTokenId: 0,
            challenger: msg.sender,
            opponent: address(0),
            status: BattleStatus.OPEN,
            winnerId: 0,
            startTime: 0,
            endTime: 0,
            duration: duration
        });

        activeBattle[challengerTokenId] = battleId;

        emit BattleCreated(battleId, battleType, msg.value, challengerTokenId, msg.sender);
    }

    function joinBattle(uint256 battleId, uint256 opponentTokenId) external payable nonReentrant whenNotPaused {
        Battle storage battle = battles[battleId];
        require(battle.status == BattleStatus.OPEN, "Not open");
        require(agentNFT.ownerOf(opponentTokenId) == msg.sender, "Not owner");
        require(agentNFT.getEvolutionStage(opponentTokenId) >= 1, "Must be hatched");
        require(msg.value >= battle.entryFee, "Insufficient entry fee");
        require(activeBattle[opponentTokenId] == 0, "Already in battle");
        require(msg.sender != battle.challenger, "Cannot fight yourself");

        battle.opponentTokenId = opponentTokenId;
        battle.opponent = msg.sender;
        battle.status = BattleStatus.ACTIVE;
        battle.startTime = uint64(block.timestamp);
        battle.endTime = uint64(block.timestamp) + battle.duration;

        activeBattle[opponentTokenId] = battleId;

        // Refund excess payment
        uint256 excess = msg.value - battle.entryFee;
        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            require(refunded, "Refund failed");
        }

        emit BattleJoined(battleId, opponentTokenId, msg.sender);
    }

    function reportResult(uint256 battleId, uint256 winnerId) external onlyOracle nonReentrant {
        Battle storage battle = battles[battleId];
        require(battle.status == BattleStatus.ACTIVE, "Not active");
        require(winnerId == battle.challengerTokenId || winnerId == battle.opponentTokenId, "Invalid winner");

        battle.winnerId = winnerId;
        battle.status = BattleStatus.COMPLETED;
        battle.endTime = uint64(block.timestamp);

        uint256 loserId = winnerId == battle.challengerTokenId ? battle.opponentTokenId : battle.challengerTokenId;
        address winnerAddr = winnerId == battle.challengerTokenId ? battle.challenger : battle.opponent;

        // Clear active battles
        activeBattle[battle.challengerTokenId] = 0;
        activeBattle[battle.opponentTokenId] = 0;

        // Distribute pot
        uint256 totalPot = battle.entryFee * 2;
        uint256 platformCut = (totalPot * platformFeeBps) / 10000;
        uint256 winnerPayout = totalPot - platformCut;

        // Pay winner (pull-pattern fallback if direct transfer fails)
        (bool sentWinner, ) = winnerAddr.call{value: winnerPayout}("");
        if (!sentWinner) {
            pendingWithdrawals[winnerAddr] += winnerPayout;
        }

        // Pay treasury (pull-pattern fallback)
        (bool sentTreasury, ) = treasury.call{value: platformCut}("");
        if (!sentTreasury) {
            pendingWithdrawals[treasury] += platformCut;
        }

        // Update leaderboard
        _updateLeaderboard(winnerId, loserId);

        // Award XP
        evolution.awardCustomXP(winnerId, winXP, "battle_win");
        evolution.awardCustomXP(loserId, loseXP, "battle_loss");

        emit BattleCompleted(battleId, winnerId, loserId);
    }

    function cancelBattle(uint256 battleId) external nonReentrant {
        Battle storage battle = battles[battleId];
        require(battle.status == BattleStatus.OPEN, "Not open");
        require(msg.sender == battle.challenger || msg.sender == owner(), "Not authorized");

        battle.status = BattleStatus.CANCELLED;
        activeBattle[battle.challengerTokenId] = 0;

        // Refund challenger
        (bool sent, ) = battle.challenger.call{value: battle.entryFee}("");
        require(sent, "Refund failed");

        emit BattleCancelled(battleId);
    }

    /// @notice Claim pending payout that failed to transfer during battle resolution
    function claimPayout() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to claim");

        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Claim failed");
    }

    // ---------------------------------------------------------------
    // READ
    // ---------------------------------------------------------------

    function getBattle(uint256 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }

    function getLeaderboard(uint256 tokenId) external view returns (LeaderboardEntry memory) {
        return leaderboard[tokenId];
    }

    // ---------------------------------------------------------------
    // INTERNAL
    // ---------------------------------------------------------------

    function _updateLeaderboard(uint256 winnerId, uint256 loserId) internal {
        LeaderboardEntry storage winner = leaderboard[winnerId];
        LeaderboardEntry storage loser = leaderboard[loserId];

        if (winner.tokenId == 0) winner.tokenId = winnerId;
        if (loser.tokenId == 0) loser.tokenId = loserId;

        winner.wins++;
        winner.currentStreak++;
        if (winner.currentStreak > winner.bestStreak) {
            winner.bestStreak = winner.currentStreak;
        }

        uint16 loserLevel = agentNFT.getAgentLevel(loserId);
        if (loserLevel > winner.highestLevelBeaten) {
            winner.highestLevelBeaten = loserLevel;
        }

        loser.losses++;
        loser.currentStreak = 0;
    }

    // ---------------------------------------------------------------
    // OWNER SETTERS — PAISLEY RULE
    // ---------------------------------------------------------------

    function setAgentNFT(address _addr) external onlyOwner { agentNFT = IAgentNFTBattle(_addr); }
    function setEvolution(address _addr) external onlyOwner { evolution = IEvolution(_addr); }
    function setTreasury(address _addr) external onlyOwner { require(_addr != address(0)); treasury = _addr; }
    function setOracle(address _addr) external onlyOwner { oracle = _addr; emit OracleUpdated(_addr); }
    function setPlatformFeeBps(uint256 _bps) external onlyOwner { require(_bps <= MAX_FEE_BPS); platformFeeBps = _bps; }
    function setWinXP(uint64 _xp) external onlyOwner { winXP = _xp; }
    function setLoseXP(uint64 _xp) external onlyOwner { loseXP = _xp; }
    function setMinEntryFee(uint256 _fee) external onlyOwner { minEntryFee = _fee; }
    function setMaxEntryFee(uint256 _fee) external onlyOwner { maxEntryFee = _fee; }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function rescueETH(address to) external onlyOwner {
        (bool sent, ) = to.call{value: address(this).balance}("");
        require(sent, "Rescue failed");
    }
}
