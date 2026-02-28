// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title X404PaymentRouter
 * @notice Central payment and revenue routing hub for the NFT Agents ecosystem
 * @dev All fees from all contracts route through here. Agents can make payments.
 *      Revenue splits configurable per-source. Supports agent-to-agent payments,
 *      subscription billing, and cross-chain revenue tracking.
 *
 *      Treasury address set at deployment via constructor
 */
contract X404PaymentRouter is Ownable, ReentrancyGuard, Pausable {
    // ---------------------------------------------------------------
    // STRUCTS
    // ---------------------------------------------------------------

    struct RevenueSource {
        string name;            // "mint_fees", "marketplace", "battle_arena", etc.
        address sourceContract;
        uint256 totalCollected;
        uint256 totalDistributed;
        bool active;
    }

    struct RevenueSplit {
        address recipient;
        uint256 bps;            // basis points (100 = 1%)
        string label;           // "treasury", "dev", "burn", "staking"
    }

    struct AgentPayment {
        uint256 paymentId;
        uint256 fromTokenId;     // agent NFT token ID (0 = external)
        uint256 toTokenId;       // destination agent (0 = platform)
        uint256 amount;
        string paymentType;      // "service_fee", "tool_usage", "subscription", "tip"
        uint64 timestamp;
    }

    struct Subscription {
        address subscriber;
        uint256 agentTokenId;    // 0 = platform subscription
        uint256 pricePerPeriod;
        uint64 periodSeconds;
        uint64 lastPayment;
        uint64 expiresAt;
        bool active;
    }

    // ---------------------------------------------------------------
    // STATE
    // ---------------------------------------------------------------

    address public treasury;
    uint256 public constant MAX_SPLIT_BPS = 10000; // 100%
    uint256 public constant TAX_CEILING_BPS = 3000; // 30% max on any single fee

    // Revenue sources (contracts that send fees here)
    mapping(uint256 => RevenueSource) public revenueSources;
    uint256 public revenueSourceCount;
    mapping(address => uint256) public contractToSourceId;

    // Revenue split configuration
    RevenueSplit[] public defaultSplits;

    // Per-source custom splits (overrides default if set)
    mapping(uint256 => RevenueSplit[]) public sourceSplits;
    mapping(uint256 => bool) public hasCustomSplits;

    // Agent payments
    mapping(uint256 => AgentPayment) public payments;
    uint256 public nextPaymentId = 1;

    // Agent balances (agents can hold funds for autonomous spending)
    mapping(uint256 => uint256) public agentBalances;

    // Subscriptions
    mapping(uint256 => Subscription) public subscriptions;
    uint256 public nextSubscriptionId = 1;

    // Revenue tracking
    uint256 public totalRevenue;
    uint256 public totalDistributed;
    uint256 public totalAgentPayments;
    mapping(string => uint256) public revenueByType; // "mint", "marketplace", "battle", "breeding", etc.

    // Authorized callers (contracts that can route payments)
    mapping(address => bool) public authorizedCallers;

    // ---------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------

    event RevenueReceived(uint256 indexed sourceId, string sourceType, uint256 amount, address from);
    event RevenueDistributed(uint256 indexed sourceId, address indexed recipient, uint256 amount, string label);
    event AgentPaymentMade(uint256 indexed paymentId, uint256 fromAgent, uint256 toAgent, uint256 amount, string paymentType);
    event AgentFunded(uint256 indexed tokenId, uint256 amount, address funder);
    event AgentWithdraw(uint256 indexed tokenId, uint256 amount, address to);
    event SubscriptionCreated(uint256 indexed subId, address subscriber, uint256 agentTokenId, uint256 price);
    event SubscriptionRenewed(uint256 indexed subId, uint64 newExpiry);
    event SubscriptionCancelled(uint256 indexed subId);
    event SourceAdded(uint256 indexed sourceId, string name, address sourceContract);
    event SplitUpdated(string label, address recipient, uint256 bps);

    // ---------------------------------------------------------------
    // MODIFIERS
    // ---------------------------------------------------------------

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    // ---------------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------------

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;

        // Default revenue split: 100% to treasury
        defaultSplits.push(RevenueSplit({
            recipient: _treasury,
            bps: 10000,
            label: "treasury"
        }));
    }

    // ---------------------------------------------------------------
    // RECEIVE REVENUE (called by ecosystem contracts)
    // ---------------------------------------------------------------

    /// @notice Primary entry point for all ecosystem revenue
    /// @param sourceType Category string for tracking (e.g., "mint", "marketplace", "battle")
    function routeRevenue(string calldata sourceType) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No value");

        uint256 sourceId = contractToSourceId[msg.sender];

        // Auto-register unknown sources from authorized callers
        if (sourceId == 0 && authorizedCallers[msg.sender]) {
            sourceId = _addSource(sourceType, msg.sender);
        }

        if (sourceId > 0) {
            revenueSources[sourceId].totalCollected += msg.value;
        }

        totalRevenue += msg.value;
        revenueByType[sourceType] += msg.value;

        emit RevenueReceived(sourceId, sourceType, msg.value, msg.sender);

        // Distribute according to splits
        _distribute(sourceId, msg.value);
    }

    /// @notice Direct deposit to treasury (simple, no splits)
    function depositToTreasury() external payable nonReentrant {
        require(msg.value > 0, "No value");
        totalRevenue += msg.value;
        revenueByType["direct"] += msg.value;

        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "Treasury transfer failed");

        emit RevenueReceived(0, "direct", msg.value, msg.sender);
    }

    // ---------------------------------------------------------------
    // AGENT PAYMENTS (agent-to-agent and agent-to-platform)
    // ---------------------------------------------------------------

    /// @notice Fund an agent's balance (so it can make autonomous payments)
    function fundAgent(uint256 tokenId) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No value");
        agentBalances[tokenId] += msg.value;
        emit AgentFunded(tokenId, msg.value, msg.sender);
    }

    /// @notice Agent makes a payment to another agent or the platform
    function agentPay(
        uint256 fromTokenId,
        uint256 toTokenId,
        uint256 amount,
        string calldata paymentType
    ) external onlyAuthorized nonReentrant whenNotPaused {
        require(agentBalances[fromTokenId] >= amount, "Insufficient agent balance");

        agentBalances[fromTokenId] -= amount;

        uint256 paymentId = nextPaymentId++;
        payments[paymentId] = AgentPayment({
            paymentId: paymentId,
            fromTokenId: fromTokenId,
            toTokenId: toTokenId,
            amount: amount,
            paymentType: paymentType,
            timestamp: uint64(block.timestamp)
        });

        totalAgentPayments += amount;

        if (toTokenId == 0) {
            // Payment to platform — route through splits
            _distribute(0, amount);
        } else {
            // Payment to another agent
            agentBalances[toTokenId] += amount;
        }

        emit AgentPaymentMade(paymentId, fromTokenId, toTokenId, amount, paymentType);
    }

    /// @notice Withdraw from agent balance (only NFT owner can do this)
    function withdrawAgentBalance(uint256 tokenId, uint256 amount, address to) external nonReentrant {
        // Caller verification should be done by the calling contract (AgentNFT checks ownership)
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
        require(agentBalances[tokenId] >= amount, "Insufficient balance");
        require(to != address(0), "Invalid recipient");

        agentBalances[tokenId] -= amount;

        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Withdraw failed");

        emit AgentWithdraw(tokenId, amount, to);
    }

    // ---------------------------------------------------------------
    // SUBSCRIPTIONS
    // ---------------------------------------------------------------

    /// @notice Create a subscription (premium features, agent compute, etc.)
    function createSubscription(
        uint256 agentTokenId,
        uint256 pricePerPeriod,
        uint64 periodSeconds
    ) external payable nonReentrant whenNotPaused {
        require(msg.value >= pricePerPeriod, "Insufficient first payment");
        require(periodSeconds >= 1 days, "Min 1 day period");

        uint256 subId = nextSubscriptionId++;

        subscriptions[subId] = Subscription({
            subscriber: msg.sender,
            agentTokenId: agentTokenId,
            pricePerPeriod: pricePerPeriod,
            periodSeconds: periodSeconds,
            lastPayment: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp) + periodSeconds,
            active: true
        });

        totalRevenue += msg.value;
        revenueByType["subscription"] += msg.value;

        _distribute(0, msg.value);

        emit SubscriptionCreated(subId, msg.sender, agentTokenId, pricePerPeriod);
    }

    /// @notice Renew a subscription
    function renewSubscription(uint256 subId) external payable nonReentrant whenNotPaused {
        Subscription storage sub = subscriptions[subId];
        require(sub.active, "Not active");
        require(msg.sender == sub.subscriber, "Not subscriber");
        require(msg.value >= sub.pricePerPeriod, "Insufficient payment");

        sub.lastPayment = uint64(block.timestamp);
        sub.expiresAt = uint64(block.timestamp) + sub.periodSeconds;

        totalRevenue += msg.value;
        revenueByType["subscription"] += msg.value;

        _distribute(0, msg.value);

        emit SubscriptionRenewed(subId, sub.expiresAt);
    }

    /// @notice Cancel a subscription
    function cancelSubscription(uint256 subId) external {
        Subscription storage sub = subscriptions[subId];
        require(sub.active, "Not active");
        require(msg.sender == sub.subscriber || msg.sender == owner(), "Not authorized");

        sub.active = false;
        emit SubscriptionCancelled(subId);
    }

    /// @notice Check if a subscription is active
    function isSubscriptionActive(uint256 subId) external view returns (bool) {
        Subscription storage sub = subscriptions[subId];
        return sub.active && block.timestamp <= sub.expiresAt;
    }

    // ---------------------------------------------------------------
    // READ FUNCTIONS
    // ---------------------------------------------------------------

    function getRevenueStats() external view returns (
        uint256 _totalRevenue,
        uint256 _totalDistributed,
        uint256 _totalAgentPayments,
        uint256 _sourceCount
    ) {
        return (totalRevenue, totalDistributed, totalAgentPayments, revenueSourceCount);
    }

    function getAgentBalance(uint256 tokenId) external view returns (uint256) {
        return agentBalances[tokenId];
    }

    function getPayment(uint256 paymentId) external view returns (AgentPayment memory) {
        return payments[paymentId];
    }

    function getDefaultSplits() external view returns (RevenueSplit[] memory) {
        return defaultSplits;
    }

    function getRevenueByType(string calldata sourceType) external view returns (uint256) {
        return revenueByType[sourceType];
    }

    // ---------------------------------------------------------------
    // INTERNAL
    // ---------------------------------------------------------------

    function _distribute(uint256 sourceId, uint256 amount) internal {
        RevenueSplit[] storage splits = hasCustomSplits[sourceId]
            ? sourceSplits[sourceId]
            : defaultSplits;

        for (uint256 i = 0; i < splits.length; i++) {
            uint256 share = (amount * splits[i].bps) / MAX_SPLIT_BPS;
            if (share > 0) {
                (bool sent, ) = splits[i].recipient.call{value: share}("");
                require(sent, "Distribution failed");
                totalDistributed += share;

                if (sourceId > 0) {
                    revenueSources[sourceId].totalDistributed += share;
                }

                emit RevenueDistributed(sourceId, splits[i].recipient, share, splits[i].label);
            }
        }
    }

    function _addSource(string memory name, address sourceContract) internal returns (uint256) {
        revenueSourceCount++;
        uint256 sourceId = revenueSourceCount;

        revenueSources[sourceId] = RevenueSource({
            name: name,
            sourceContract: sourceContract,
            totalCollected: 0,
            totalDistributed: 0,
            active: true
        });

        contractToSourceId[sourceContract] = sourceId;
        emit SourceAdded(sourceId, name, sourceContract);
        return sourceId;
    }

    // ---------------------------------------------------------------
    // OWNER SETTERS — PAISLEY RULE
    // ---------------------------------------------------------------

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid");
        treasury = _treasury;
    }

    function addRevenueSource(string calldata name, address sourceContract) external onlyOwner {
        _addSource(name, sourceContract);
    }

    function setSourceActive(uint256 sourceId, bool active) external onlyOwner {
        revenueSources[sourceId].active = active;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    function setDefaultSplits(RevenueSplit[] calldata splits) external onlyOwner {
        uint256 totalBps = 0;
        for (uint256 i = 0; i < splits.length; i++) {
            totalBps += splits[i].bps;
        }
        require(totalBps == MAX_SPLIT_BPS, "Splits must total 100%");

        delete defaultSplits;
        for (uint256 i = 0; i < splits.length; i++) {
            defaultSplits.push(splits[i]);
            emit SplitUpdated(splits[i].label, splits[i].recipient, splits[i].bps);
        }
    }

    function setSourceSplits(uint256 sourceId, RevenueSplit[] calldata splits) external onlyOwner {
        uint256 totalBps = 0;
        for (uint256 i = 0; i < splits.length; i++) {
            totalBps += splits[i].bps;
        }
        require(totalBps == MAX_SPLIT_BPS, "Splits must total 100%");

        delete sourceSplits[sourceId];
        for (uint256 i = 0; i < splits.length; i++) {
            sourceSplits[sourceId].push(splits[i]);
        }
        hasCustomSplits[sourceId] = true;
    }

    function removeSourceSplits(uint256 sourceId) external onlyOwner {
        delete sourceSplits[sourceId];
        hasCustomSplits[sourceId] = false;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function rescueETH(address to) external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH");
        (bool sent, ) = to.call{value: balance}("");
        require(sent, "Rescue failed");
    }

    function rescueERC20(address token, address to) external onlyOwner {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(success, "Balance check failed");
        uint256 balance = abi.decode(data, (uint256));
        (bool sent, bytes memory result) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, balance)
        );
        require(sent && (result.length == 0 || abi.decode(result, (bool))), "Rescue failed");
    }

    receive() external payable {
        totalRevenue += msg.value;
        revenueByType["direct"] += msg.value;
        // Direct sends go to treasury only (avoid complex distribution in receive
        // which could fail due to gas limits or recipient reverting)
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "Treasury transfer failed");
    }
}
