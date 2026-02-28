// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Pokedex
 * @notice On-chain registry of all Agent types (elements)
 * @dev Catalogs types, base stats, rarity, total minted/active
 */
contract Pokedex is Ownable {
    // ---------------------------------------------------------------
    // STRUCTS
    // ---------------------------------------------------------------

    struct BaseStats {
        uint16 contextWindowSize; // in KB
        uint8 maxConcurrentTasks;
        uint8 skillSlots;
        uint8 speed;
        uint8 accuracy;
        uint8 endurance;
        uint8 creativity;
    }

    struct AgentType {
        uint8 typeId;
        string typeName;
        uint8 element;          // 0-9
        string description;
        BaseStats baseStats;
        uint256 totalMinted;
        uint256 totalActive;
        uint256 totalBurned;
        bool exists;
    }

    // ---------------------------------------------------------------
    // STATE
    // ---------------------------------------------------------------

    uint8 public typeCount;
    mapping(uint8 => AgentType) public agentTypes;
    mapping(string => uint8) public typeNameToId;

    // ---------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------

    event TypeAdded(uint8 indexed typeId, string typeName, uint8 element);
    event TypeUpdated(uint8 indexed typeId);
    event MintCountUpdated(uint8 indexed typeId, uint256 totalMinted);
    event ActiveCountUpdated(uint8 indexed typeId, uint256 totalActive);

    // ---------------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------------

    constructor() Ownable(msg.sender) {
        // Register the 10 base types
        _addType("FIRE",     0, "Trading/DeFi - aggressive, fast",    BaseStats(4,  2, 2, 90, 60, 50, 70));
        _addType("WATER",    1, "Research/Data - deep analysis",      BaseStats(8,  2, 2, 50, 90, 80, 60));
        _addType("ELECTRIC", 2, "Bots/Automation - Telegram, cron",   BaseStats(4,  3, 2, 95, 70, 40, 50));
        _addType("PSYCHIC",  3, "AI/LLM - code gen, reasoning",      BaseStats(16, 2, 3, 60, 85, 55, 95));
        _addType("EARTH",    4, "Infrastructure - DevOps, deploy",    BaseStats(8,  3, 2, 40, 75, 95, 40));
        _addType("DARK",     5, "Security/Audit - vuln scanning",     BaseStats(4,  2, 2, 70, 95, 60, 50));
        _addType("DRAGON",   6, "Multi-chain - bridges, arbitrage",   BaseStats(8,  4, 3, 80, 80, 70, 80));
        _addType("GHOST",    7, "Stealth - MEV, private txs",         BaseStats(4,  2, 2, 85, 65, 45, 75));
        _addType("STEEL",    8, "Smart Contracts - Solidity guru",    BaseStats(8,  2, 3, 55, 90, 90, 55));
        _addType("NATURE",   9, "Content/Creative - art, writing",    BaseStats(8,  2, 2, 65, 70, 70, 90));
    }

    // ---------------------------------------------------------------
    // READ
    // ---------------------------------------------------------------

    function getType(uint8 typeId) external view returns (AgentType memory) {
        require(agentTypes[typeId].exists, "Type not found");
        return agentTypes[typeId];
    }

    function getTypeByName(string calldata name) external view returns (AgentType memory) {
        uint8 typeId = typeNameToId[name];
        require(agentTypes[typeId].exists, "Type not found");
        return agentTypes[typeId];
    }

    function getAllTypes() external view returns (AgentType[] memory) {
        AgentType[] memory types = new AgentType[](typeCount);
        for (uint8 i = 0; i < typeCount; i++) {
            types[i] = agentTypes[i];
        }
        return types;
    }

    function getBaseStats(uint8 typeId) external view returns (BaseStats memory) {
        require(agentTypes[typeId].exists, "Type not found");
        return agentTypes[typeId].baseStats;
    }

    // ---------------------------------------------------------------
    // WRITE - ADMIN
    // ---------------------------------------------------------------

    function addType(
        string calldata typeName,
        uint8 element,
        string calldata description,
        BaseStats calldata baseStats
    ) external onlyOwner {
        _addType(typeName, element, description, baseStats);
    }

    function updateType(
        uint8 typeId,
        string calldata typeName,
        string calldata description,
        BaseStats calldata baseStats
    ) external onlyOwner {
        require(agentTypes[typeId].exists, "Type not found");
        agentTypes[typeId].typeName = typeName;
        agentTypes[typeId].description = description;
        agentTypes[typeId].baseStats = baseStats;
        emit TypeUpdated(typeId);
    }

    function updateMintCount(uint8 typeId, uint256 count) external onlyOwner {
        require(agentTypes[typeId].exists, "Type not found");
        agentTypes[typeId].totalMinted = count;
        emit MintCountUpdated(typeId, count);
    }

    function incrementMintCount(uint8 typeId) external onlyOwner {
        require(agentTypes[typeId].exists, "Type not found");
        agentTypes[typeId].totalMinted++;
        emit MintCountUpdated(typeId, agentTypes[typeId].totalMinted);
    }

    function updateActiveCount(uint8 typeId, uint256 count) external onlyOwner {
        require(agentTypes[typeId].exists, "Type not found");
        agentTypes[typeId].totalActive = count;
        emit ActiveCountUpdated(typeId, count);
    }

    function setTypeDescription(uint8 typeId, string calldata description) external onlyOwner {
        require(agentTypes[typeId].exists, "Type not found");
        agentTypes[typeId].description = description;
    }

    function setTypeBaseStats(uint8 typeId, BaseStats calldata baseStats) external onlyOwner {
        require(agentTypes[typeId].exists, "Type not found");
        agentTypes[typeId].baseStats = baseStats;
    }

    // ---------------------------------------------------------------
    // INTERNAL
    // ---------------------------------------------------------------

    function _addType(
        string memory typeName,
        uint8 element,
        string memory description,
        BaseStats memory baseStats
    ) internal {
        uint8 typeId = typeCount;
        agentTypes[typeId] = AgentType({
            typeId: typeId,
            typeName: typeName,
            element: element,
            description: description,
            baseStats: baseStats,
            totalMinted: 0,
            totalActive: 0,
            totalBurned: 0,
            exists: true
        });
        typeNameToId[typeName] = typeId;
        typeCount++;
        emit TypeAdded(typeId, typeName, element);
    }

    // ---------------------------------------------------------------
    // EMERGENCY
    // ---------------------------------------------------------------

    function rescueETH(address to) external onlyOwner {
        (bool sent, ) = to.call{value: address(this).balance}("");
        require(sent, "Rescue failed");
    }

    function rescueERC20(address token, address to) external onlyOwner {
        (bool sent, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to,
                abi.decode(
                    _staticCall(token, abi.encodeWithSignature("balanceOf(address)", address(this))),
                    (uint256)
                )
            )
        );
        require(sent && (data.length == 0 || abi.decode(data, (bool))), "Rescue failed");
    }

    function _staticCall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory result) = target.staticcall(data);
        require(success, "Static call failed");
        return result;
    }
}
