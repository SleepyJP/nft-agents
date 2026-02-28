// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AgentNFT
 * @notice Core ERC-721 contract for Pokémon-style AI Agent NFTs on JasmyChain (680)
 * @dev Extended metadata, tiered minting, shiny rolls, evolution support
 *      Tax ceiling: 30% | Paisley Rule: every param has a setter | Emergency rescue
 */
contract AgentNFT is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    ERC2981,
    Ownable,
    ReentrancyGuard,
    Pausable
{
    // ---------------------------------------------------------------
    // STRUCTS
    // ---------------------------------------------------------------

    struct AgentData {
        uint8 element;        // 0-9 mapping to ElementType
        uint8 evolutionStage; // 0=EGG, 1=BABY, 2=JUVENILE, 3=ADULT, 4=ALPHA, 5=APEX
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

    struct MintTier {
        uint256 price;
        uint16 maxSupply;
        uint16 minted;
        bool active;
    }

    // ---------------------------------------------------------------
    // STATE
    // ---------------------------------------------------------------

    uint256 private _nextTokenId = 1;
    uint256 public constant GENESIS_SUPPLY = 1000;
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public constant TAX_CEILING_BPS = 3000; // 30%
    uint256 public constant MAX_BREEDS = 3;

    address public treasury;
    address public evolutionContract;
    address public battleContract;
    address public breedingContract;
    address public marketplaceContract;

    string public baseMetadataURI;

    // Shiny / Mythic odds (denominator — 1/N chance)
    uint256 public shinyChance = 100;
    uint256 public mythicChance = 1000;

    // Token data
    mapping(uint256 => AgentData) public agents;

    // Mint tiers: 0=COMMON, 1=RARE, 2=LEGENDARY
    mapping(uint256 => MintTier) public mintTiers;

    // Approved contracts that can modify agent data
    mapping(address => bool) public authorizedOperators;

    // Starter pack tracking (one per wallet)
    mapping(address => bool) public hasClaimedStarter;

    // ---------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------

    event AgentMinted(uint256 indexed tokenId, address indexed owner, uint8 element, bool isShiny, bool isMythic, bool isGenesis);
    event AgentEvolved(uint256 indexed tokenId, uint8 newStage, uint16 newLevel);
    event XPGained(uint256 indexed tokenId, uint64 amount, string source);
    event StarterClaimed(address indexed user, uint256 tokenId, uint8 starterChoice);
    event TreasuryUpdated(address indexed newTreasury);
    event OperatorUpdated(address indexed operator, bool authorized);
    event EmergencyRescue(address indexed token, uint256 amount, address indexed to);

    // ---------------------------------------------------------------
    // MODIFIERS
    // ---------------------------------------------------------------

    modifier onlyAuthorized() {
        require(authorizedOperators[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        _;
    }

    // ---------------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------------

    constructor(
        address _treasury,
        string memory baseURI_,
        uint96 _royaltyBps
    ) ERC721("NFT Agents", "AGENT") Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        require(_royaltyBps <= TAX_CEILING_BPS, "Exceeds tax ceiling");

        treasury = _treasury;
        baseMetadataURI = baseURI_;

        _setDefaultRoyalty(_treasury, _royaltyBps);

        // Initialize mint tiers (prices in JASMY wei)
        mintTiers[0] = MintTier({ price: 10 ether, maxSupply: 7000, minted: 0, active: true });   // COMMON
        mintTiers[1] = MintTier({ price: 50 ether, maxSupply: 2500, minted: 0, active: true });   // RARE
        mintTiers[2] = MintTier({ price: 500 ether, maxSupply: 500, minted: 0, active: true });   // LEGENDARY
    }

    // ---------------------------------------------------------------
    // MINTING
    // ---------------------------------------------------------------

    function mint(uint8 element, uint256 tier) external payable nonReentrant whenNotPaused {
        require(element < 10, "Invalid element");
        require(tier < 3, "Invalid tier");
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");

        MintTier storage mt = mintTiers[tier];
        require(mt.active, "Tier not active");
        require(mt.minted < mt.maxSupply, "Tier sold out");
        require(msg.value >= mt.price, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        mt.minted++;

        // Shiny / Mythic roll
        bool isShiny = _rollRarity(tokenId, shinyChance);
        bool isMythic = _rollRarity(tokenId + 1, mythicChance);
        bool isGenesis = tokenId <= GENESIS_SUPPLY;

        agents[tokenId] = AgentData({
            element: element,
            evolutionStage: 0, // EGG
            level: 0,
            xp: 0,
            isShiny: isShiny,
            isMythic: isMythic,
            isGenesis: isGenesis,
            parentA: 0,
            parentB: 0,
            breedCount: 0,
            mintedAt: uint64(block.timestamp)
        });

        _safeMint(msg.sender, tokenId);

        // Route exact price to treasury, refund excess
        (bool sent, ) = treasury.call{value: mt.price}("");
        require(sent, "Treasury transfer failed");

        uint256 excess = msg.value - mt.price;
        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            require(refunded, "Refund failed");
        }

        emit AgentMinted(tokenId, msg.sender, element, isShiny, isMythic, isGenesis);
    }

    function mintStarter(uint8 starterChoice) external nonReentrant whenNotPaused {
        require(starterChoice < 3, "Invalid starter");
        require(!hasClaimedStarter[msg.sender], "Already claimed");
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");

        hasClaimedStarter[msg.sender] = true;

        uint256 tokenId = _nextTokenId++;

        // Starters: 0=FIRE(Embertrade), 1=WATER(Aquascan), 2=ELECTRIC(Voltbot)
        uint8[3] memory starterElements = [0, 1, 2]; // FIRE, WATER, ELECTRIC

        bool isGenesis = tokenId <= GENESIS_SUPPLY;

        agents[tokenId] = AgentData({
            element: starterElements[starterChoice],
            evolutionStage: 1, // BABY (hatched)
            level: 1,
            xp: 0,
            isShiny: false,
            isMythic: false,
            isGenesis: isGenesis,
            parentA: 0,
            parentB: 0,
            breedCount: 0,
            mintedAt: uint64(block.timestamp)
        });

        _safeMint(msg.sender, tokenId);

        emit StarterClaimed(msg.sender, tokenId, starterChoice);
    }

    /// @notice Mint a starter on behalf of a user (called by StarterPack contract)
    function mintStarterFor(address to, uint8 starterChoice) external onlyAuthorized nonReentrant whenNotPaused {
        require(starterChoice < 3, "Invalid starter");
        require(!hasClaimedStarter[to], "Already claimed");
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");

        hasClaimedStarter[to] = true;

        uint256 tokenId = _nextTokenId++;

        uint8[3] memory starterElements = [0, 1, 2];

        bool isGenesis = tokenId <= GENESIS_SUPPLY;

        agents[tokenId] = AgentData({
            element: starterElements[starterChoice],
            evolutionStage: 1,
            level: 1,
            xp: 0,
            isShiny: false,
            isMythic: false,
            isGenesis: isGenesis,
            parentA: 0,
            parentB: 0,
            breedCount: 0,
            mintedAt: uint64(block.timestamp)
        });

        _safeMint(to, tokenId);

        emit StarterClaimed(to, tokenId, starterChoice);
    }

    // ---------------------------------------------------------------
    // AGENT DATA — AUTHORIZED OPERATORS
    // ---------------------------------------------------------------

    function setAgentXP(uint256 tokenId, uint64 newXP, string calldata source) external onlyAuthorized tokenExists(tokenId) {
        agents[tokenId].xp = newXP;
        emit XPGained(tokenId, newXP, source);
    }

    function addAgentXP(uint256 tokenId, uint64 amount, string calldata source) external onlyAuthorized tokenExists(tokenId) {
        agents[tokenId].xp += amount;
        emit XPGained(tokenId, amount, source);
    }

    function setAgentLevel(uint256 tokenId, uint16 newLevel) external onlyAuthorized tokenExists(tokenId) {
        agents[tokenId].level = newLevel;
    }

    function setEvolutionStage(uint256 tokenId, uint8 newStage) external onlyAuthorized tokenExists(tokenId) {
        require(newStage <= 5, "Invalid stage");
        require(newStage > agents[tokenId].evolutionStage, "Cannot de-evolve");
        agents[tokenId].evolutionStage = newStage;
        emit AgentEvolved(tokenId, newStage, agents[tokenId].level);
    }

    function setBreedCount(uint256 tokenId, uint8 count) external onlyAuthorized tokenExists(tokenId) {
        require(count <= MAX_BREEDS, "Exceeds max breeds");
        agents[tokenId].breedCount = count;
    }

    function setParents(uint256 tokenId, uint16 parentA, uint16 parentB) external onlyAuthorized tokenExists(tokenId) {
        agents[tokenId].parentA = parentA;
        agents[tokenId].parentB = parentB;
    }

    function mintBreedResult(
        address to,
        uint8 element,
        uint16 parentA,
        uint16 parentB
    ) external onlyAuthorized nonReentrant returns (uint256) {
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");

        uint256 tokenId = _nextTokenId++;
        bool isShiny = _rollRarity(tokenId, shinyChance);

        agents[tokenId] = AgentData({
            element: element,
            evolutionStage: 0, // EGG
            level: 0,
            xp: 0,
            isShiny: isShiny,
            isMythic: false,
            isGenesis: false,
            parentA: parentA,
            parentB: parentB,
            breedCount: 0,
            mintedAt: uint64(block.timestamp)
        });

        _safeMint(to, tokenId);

        emit AgentMinted(tokenId, to, element, isShiny, false, false);
        return tokenId;
    }

    // ---------------------------------------------------------------
    // READ FUNCTIONS
    // ---------------------------------------------------------------

    function getAgent(uint256 tokenId) external view tokenExists(tokenId) returns (AgentData memory) {
        return agents[tokenId];
    }

    function getAgentElement(uint256 tokenId) external view tokenExists(tokenId) returns (uint8) {
        return agents[tokenId].element;
    }

    function getAgentLevel(uint256 tokenId) external view tokenExists(tokenId) returns (uint16) {
        return agents[tokenId].level;
    }

    function getAgentXP(uint256 tokenId) external view tokenExists(tokenId) returns (uint64) {
        return agents[tokenId].xp;
    }

    function getEvolutionStage(uint256 tokenId) external view tokenExists(tokenId) returns (uint8) {
        return agents[tokenId].evolutionStage;
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // ---------------------------------------------------------------
    // OWNER SETTERS — PAISLEY RULE
    // ---------------------------------------------------------------

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setEvolutionContract(address _contract) external onlyOwner {
        evolutionContract = _contract;
        authorizedOperators[_contract] = true;
        emit OperatorUpdated(_contract, true);
    }

    function setBattleContract(address _contract) external onlyOwner {
        battleContract = _contract;
        authorizedOperators[_contract] = true;
        emit OperatorUpdated(_contract, true);
    }

    function setBreedingContract(address _contract) external onlyOwner {
        breedingContract = _contract;
        authorizedOperators[_contract] = true;
        emit OperatorUpdated(_contract, true);
    }

    function setMarketplaceContract(address _contract) external onlyOwner {
        marketplaceContract = _contract;
        authorizedOperators[_contract] = true;
        emit OperatorUpdated(_contract, true);
    }

    function setAuthorizedOperator(address operator, bool authorized) external onlyOwner {
        authorizedOperators[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }

    function setBaseMetadataURI(string calldata _uri) external onlyOwner {
        baseMetadataURI = _uri;
    }

    function setTokenURI(uint256 tokenId, string calldata _tokenURI) external onlyAuthorized {
        _setTokenURI(tokenId, _tokenURI);
    }

    function setShinyChance(uint256 _chance) external onlyOwner {
        require(_chance >= 10, "Too generous");
        shinyChance = _chance;
    }

    function setMythicChance(uint256 _chance) external onlyOwner {
        require(_chance >= 100, "Too generous");
        mythicChance = _chance;
    }

    function setMintTier(uint256 tier, uint256 price, uint16 maxSupply, bool active) external onlyOwner {
        require(tier < 3, "Invalid tier");
        mintTiers[tier].price = price;
        mintTiers[tier].maxSupply = maxSupply;
        mintTiers[tier].active = active;
    }

    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
        require(feeNumerator <= TAX_CEILING_BPS, "Exceeds tax ceiling");
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function setStarterClaimed(address user, bool claimed) external onlyOwner {
        hasClaimedStarter[user] = claimed;
    }

    // ---------------------------------------------------------------
    // PAUSE / EMERGENCY
    // ---------------------------------------------------------------

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function rescueETH(address to) external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to rescue");
        (bool sent, ) = to.call{value: balance}("");
        require(sent, "Rescue failed");
        emit EmergencyRescue(address(0), balance, to);
    }

    function rescueERC20(address token, address to) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to rescue");
        bool success = IERC20(token).transfer(to, balance);
        require(success, "ERC20 transfer failed");
        emit EmergencyRescue(token, balance, to);
    }

    // ---------------------------------------------------------------
    // INTERNAL
    // ---------------------------------------------------------------

    function _rollRarity(uint256 seed, uint256 chance) internal view returns (bool) {
        return uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), seed, msg.sender, block.timestamp))) % chance == 0;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseMetadataURI;
    }

    // ---------------------------------------------------------------
    // OVERRIDES
    // ---------------------------------------------------------------

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {}
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}
