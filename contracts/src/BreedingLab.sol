// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IAgentNFTBreed {
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

    function ownerOf(uint256 tokenId) external view returns (address);
    function getAgent(uint256 tokenId) external view returns (AgentData memory);
    function setBreedCount(uint256 tokenId, uint8 count) external;
    function mintBreedResult(address to, uint8 element, uint16 parentA, uint16 parentB) external returns (uint256);
}

/**
 * @title BreedingLab
 * @notice Fusion system for combining two Agent NFTs into a hybrid
 * @dev Type combination matrix, stat inheritance, lineage tracking
 */
contract BreedingLab is Ownable, ReentrancyGuard, Pausable {
    // ---------------------------------------------------------------
    // STATE
    // ---------------------------------------------------------------

    IAgentNFTBreed public agentNFT;
    address public treasury;

    uint256 public breedingFee = 25 ether; // JASMY
    uint256 public burnPercentage = 50;     // 50% of fee is burned (sent to dead address)
    uint8 public constant MAX_BREEDS = 3;
    uint8 public minEvolutionStage = 3;     // ADULT (stage 3) minimum
    uint64 public breedCooldown = 7 days;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Last breed timestamp per token
    mapping(uint256 => uint64) public lastBreedTime;

    // Type combination matrix: [parentA_element][parentB_element] => hybrid_element
    // Defaults to parentA's element if no special combo is set
    mapping(uint8 => mapping(uint8 => uint8)) public typeMatrix;
    mapping(uint8 => mapping(uint8 => bool)) public typeMatrixSet;

    // ---------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------

    event Bred(uint256 indexed parentA, uint256 indexed parentB, uint256 indexed childId, uint8 childElement, address breeder);
    event BreedingFeeUpdated(uint256 newFee);
    event TypeMatrixUpdated(uint8 elementA, uint8 elementB, uint8 result);

    // ---------------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------------

    constructor(address _agentNFT, address _treasury) Ownable(msg.sender) {
        require(_agentNFT != address(0) && _treasury != address(0), "Invalid address");
        agentNFT = IAgentNFTBreed(_agentNFT);
        treasury = _treasury;

        // Special type combos that produce unique hybrid types
        // DRAGON + GHOST = GHOST (Spectral Wyrm — mythic potential)
        _setTypeCombo(6, 7, 7);
        _setTypeCombo(7, 6, 7);
        // FIRE + ELECTRIC = ELECTRIC (Plasma Storm)
        _setTypeCombo(0, 2, 2);
        _setTypeCombo(2, 0, 2);
        // PSYCHIC + DARK = DARK (Shadow Mind)
        _setTypeCombo(3, 5, 5);
        _setTypeCombo(5, 3, 5);
        // WATER + NATURE = NATURE (Coral Bloom)
        _setTypeCombo(1, 9, 9);
        _setTypeCombo(9, 1, 9);
        // STEEL + EARTH = EARTH (Iron Golem)
        _setTypeCombo(8, 4, 4);
        _setTypeCombo(4, 8, 4);
    }

    // ---------------------------------------------------------------
    // BREEDING
    // ---------------------------------------------------------------

    function breed(uint256 parentAId, uint256 parentBId) external payable nonReentrant whenNotPaused returns (uint256) {
        require(parentAId != parentBId, "Cannot breed with self");
        require(msg.value >= breedingFee, "Insufficient fee");

        // Verify ownership
        require(agentNFT.ownerOf(parentAId) == msg.sender, "Not owner of parent A");
        require(agentNFT.ownerOf(parentBId) == msg.sender, "Not owner of parent B");

        // Get parent data
        IAgentNFTBreed.AgentData memory parentA = agentNFT.getAgent(parentAId);
        IAgentNFTBreed.AgentData memory parentB = agentNFT.getAgent(parentBId);

        // Eligibility checks
        require(parentA.evolutionStage >= minEvolutionStage, "Parent A not evolved enough");
        require(parentB.evolutionStage >= minEvolutionStage, "Parent B not evolved enough");
        require(parentA.breedCount < MAX_BREEDS, "Parent A max breeds reached");
        require(parentB.breedCount < MAX_BREEDS, "Parent B max breeds reached");
        require(block.timestamp >= lastBreedTime[parentAId] + breedCooldown, "Parent A on cooldown");
        require(block.timestamp >= lastBreedTime[parentBId] + breedCooldown, "Parent B on cooldown");

        // Determine hybrid element
        uint8 childElement = _determineElement(parentA.element, parentB.element);

        // Increment breed counts
        agentNFT.setBreedCount(parentAId, parentA.breedCount + 1);
        agentNFT.setBreedCount(parentBId, parentB.breedCount + 1);

        // Set cooldowns
        lastBreedTime[parentAId] = uint64(block.timestamp);
        lastBreedTime[parentBId] = uint64(block.timestamp);

        // Verify token IDs fit in uint16 (parent fields are uint16 in AgentData)
        require(parentAId <= type(uint16).max, "Parent A ID overflow");
        require(parentBId <= type(uint16).max, "Parent B ID overflow");

        // Mint hybrid
        uint256 childId = agentNFT.mintBreedResult(
            msg.sender,
            childElement,
            uint16(parentAId),
            uint16(parentBId)
        );

        // Refund excess fee
        uint256 excess = msg.value - breedingFee;
        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            require(refunded, "Refund failed");
        }

        // Distribute fee (use exact breedingFee, not msg.value)
        uint256 burnAmount = (breedingFee * burnPercentage) / 100;
        uint256 treasuryAmount = breedingFee - burnAmount;

        if (burnAmount > 0) {
            (bool burnSent, ) = DEAD_ADDRESS.call{value: burnAmount}("");
            require(burnSent, "Burn failed");
        }
        if (treasuryAmount > 0) {
            (bool treasurySent, ) = treasury.call{value: treasuryAmount}("");
            require(treasurySent, "Treasury transfer failed");
        }

        emit Bred(parentAId, parentBId, childId, childElement, msg.sender);
        return childId;
    }

    // ---------------------------------------------------------------
    // READ
    // ---------------------------------------------------------------

    function canBreed(uint256 parentAId, uint256 parentBId) external view returns (bool, string memory) {
        if (parentAId == parentBId) return (false, "Same token");

        IAgentNFTBreed.AgentData memory parentA = agentNFT.getAgent(parentAId);
        IAgentNFTBreed.AgentData memory parentB = agentNFT.getAgent(parentBId);

        if (parentA.evolutionStage < minEvolutionStage) return (false, "Parent A not evolved");
        if (parentB.evolutionStage < minEvolutionStage) return (false, "Parent B not evolved");
        if (parentA.breedCount >= MAX_BREEDS) return (false, "Parent A max breeds");
        if (parentB.breedCount >= MAX_BREEDS) return (false, "Parent B max breeds");
        if (block.timestamp < lastBreedTime[parentAId] + breedCooldown) return (false, "Parent A cooldown");
        if (block.timestamp < lastBreedTime[parentBId] + breedCooldown) return (false, "Parent B cooldown");

        return (true, "");
    }

    function previewHybridElement(uint8 elementA, uint8 elementB) external view returns (uint8) {
        return _determineElement(elementA, elementB);
    }

    // ---------------------------------------------------------------
    // INTERNAL
    // ---------------------------------------------------------------

    function _determineElement(uint8 elementA, uint8 elementB) internal view returns (uint8) {
        if (typeMatrixSet[elementA][elementB]) {
            return typeMatrix[elementA][elementB];
        }
        // Default: primary type from parent A
        return elementA;
    }

    function _setTypeCombo(uint8 elementA, uint8 elementB, uint8 result) internal {
        typeMatrix[elementA][elementB] = result;
        typeMatrixSet[elementA][elementB] = true;
    }

    // ---------------------------------------------------------------
    // OWNER SETTERS — PAISLEY RULE
    // ---------------------------------------------------------------

    function setAgentNFT(address _addr) external onlyOwner { agentNFT = IAgentNFTBreed(_addr); }
    function setTreasury(address _addr) external onlyOwner { require(_addr != address(0)); treasury = _addr; }
    function setBreedingFee(uint256 _fee) external onlyOwner { breedingFee = _fee; emit BreedingFeeUpdated(_fee); }
    function setBurnPercentage(uint256 _pct) external onlyOwner { require(_pct <= 100); burnPercentage = _pct; }
    function setMinEvolutionStage(uint8 _stage) external onlyOwner { require(_stage <= 5); minEvolutionStage = _stage; }
    function setBreedCooldown(uint64 _cooldown) external onlyOwner { breedCooldown = _cooldown; }

    function setTypeCombo(uint8 elementA, uint8 elementB, uint8 result) external onlyOwner {
        require(elementA < 10 && elementB < 10 && result < 10, "Invalid element");
        _setTypeCombo(elementA, elementB, result);
        emit TypeMatrixUpdated(elementA, elementB, result);
    }

    function removeTypeCombo(uint8 elementA, uint8 elementB) external onlyOwner {
        typeMatrixSet[elementA][elementB] = false;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function rescueETH(address to) external onlyOwner {
        (bool sent, ) = to.call{value: address(this).balance}("");
        require(sent, "Rescue failed");
    }
}
