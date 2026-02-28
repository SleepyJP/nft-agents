// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/**
 * @title Marketplace
 * @notice Trading hub for Agent NFTs — fixed price and auction
 * @dev Royalty enforcement (ERC-2981), platform fees, revenue routing to treasury
 */
contract Marketplace is Ownable, ReentrancyGuard, Pausable {
    // ---------------------------------------------------------------
    // ENUMS & STRUCTS
    // ---------------------------------------------------------------

    enum ListingType { FIXED_PRICE, AUCTION }
    enum ListingStatus { ACTIVE, SOLD, CANCELLED, EXPIRED }

    struct Listing {
        uint256 listingId;
        uint256 tokenId;
        address seller;
        uint256 price;           // Fixed price or starting price for auction
        ListingType listingType;
        ListingStatus status;
        uint256 highestBid;
        address highestBidder;
        uint64 createdAt;
        uint64 expiresAt;        // 0 = no expiry for fixed price
    }

    // ---------------------------------------------------------------
    // STATE
    // ---------------------------------------------------------------

    IERC721 public agentNFT;
    address public treasury;

    uint256 public nextListingId = 1;
    uint256 public platformFeeBps = 200;   // 2%
    uint256 public constant MAX_FEE_BPS = 3000; // 30% ceiling

    uint64 public minAuctionDuration = 1 hours;
    uint64 public maxAuctionDuration = 30 days;

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => uint256) public tokenToListing; // tokenId => active listingId

    // Bid tracking for auctions
    mapping(uint256 => mapping(address => uint256)) public bidDeposits; // listingId => bidder => amount

    // ---------------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------------

    event Listed(uint256 indexed listingId, uint256 indexed tokenId, address seller, uint256 price, ListingType listingType);
    event Sold(uint256 indexed listingId, uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event BidPlaced(uint256 indexed listingId, address bidder, uint256 amount);
    event BidWithdrawn(uint256 indexed listingId, address bidder, uint256 amount);
    event ListingCancelled(uint256 indexed listingId);
    event AuctionFinalized(uint256 indexed listingId, address winner, uint256 amount);

    // ---------------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------------

    constructor(address _agentNFT, address _treasury) Ownable(msg.sender) {
        require(_agentNFT != address(0) && _treasury != address(0), "Invalid address");
        agentNFT = IERC721(_agentNFT);
        treasury = _treasury;
    }

    // ---------------------------------------------------------------
    // LIST
    // ---------------------------------------------------------------

    function listFixedPrice(uint256 tokenId, uint256 price) external nonReentrant whenNotPaused {
        require(agentNFT.ownerOf(tokenId) == msg.sender, "Not owner");
        require(agentNFT.isApprovedForAll(msg.sender, address(this)), "Must use setApprovalForAll");
        require(price > 0, "Price must be > 0");
        require(tokenToListing[tokenId] == 0, "Already listed");

        uint256 listingId = nextListingId++;

        listings[listingId] = Listing({
            listingId: listingId,
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            listingType: ListingType.FIXED_PRICE,
            status: ListingStatus.ACTIVE,
            highestBid: 0,
            highestBidder: address(0),
            createdAt: uint64(block.timestamp),
            expiresAt: 0
        });

        tokenToListing[tokenId] = listingId;

        emit Listed(listingId, tokenId, msg.sender, price, ListingType.FIXED_PRICE);
    }

    function listAuction(uint256 tokenId, uint256 startingPrice, uint64 duration) external nonReentrant whenNotPaused {
        require(agentNFT.ownerOf(tokenId) == msg.sender, "Not owner");
        require(agentNFT.isApprovedForAll(msg.sender, address(this)), "Must use setApprovalForAll");
        require(startingPrice > 0, "Price must be > 0");
        require(tokenToListing[tokenId] == 0, "Already listed");
        require(duration >= minAuctionDuration && duration <= maxAuctionDuration, "Invalid duration");

        uint256 listingId = nextListingId++;

        listings[listingId] = Listing({
            listingId: listingId,
            tokenId: tokenId,
            seller: msg.sender,
            price: startingPrice,
            listingType: ListingType.AUCTION,
            status: ListingStatus.ACTIVE,
            highestBid: 0,
            highestBidder: address(0),
            createdAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp) + duration
        });

        tokenToListing[tokenId] = listingId;

        emit Listed(listingId, tokenId, msg.sender, startingPrice, ListingType.AUCTION);
    }

    // ---------------------------------------------------------------
    // BUY (Fixed Price)
    // ---------------------------------------------------------------

    function buy(uint256 listingId) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.ACTIVE, "Not active");
        require(listing.listingType == ListingType.FIXED_PRICE, "Not fixed price");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy own listing");

        listing.status = ListingStatus.SOLD;
        tokenToListing[listing.tokenId] = 0;

        _executeSale(listing.tokenId, listing.seller, msg.sender, listing.price);

        // Refund excess payment
        uint256 excess = msg.value - listing.price;
        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            require(refunded, "Refund failed");
        }

        emit Sold(listingId, listing.tokenId, listing.seller, msg.sender, listing.price);
    }

    // ---------------------------------------------------------------
    // BID (Auction)
    // ---------------------------------------------------------------

    function bid(uint256 listingId) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.ACTIVE, "Not active");
        require(listing.listingType == ListingType.AUCTION, "Not auction");
        require(block.timestamp < listing.expiresAt, "Auction ended");
        require(msg.sender != listing.seller, "Cannot bid on own");

        uint256 totalBid = bidDeposits[listingId][msg.sender] + msg.value;
        require(totalBid > listing.highestBid, "Bid too low");
        require(totalBid >= listing.price, "Below starting price");

        bidDeposits[listingId][msg.sender] = totalBid;
        listing.highestBid = totalBid;
        listing.highestBidder = msg.sender;

        emit BidPlaced(listingId, msg.sender, totalBid);
    }

    function withdrawBid(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(msg.sender != listing.highestBidder, "Highest bidder cannot withdraw");

        uint256 amount = bidDeposits[listingId][msg.sender];
        require(amount > 0, "No bid to withdraw");

        bidDeposits[listingId][msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Withdraw failed");

        emit BidWithdrawn(listingId, msg.sender, amount);
    }

    function finalizeAuction(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.ACTIVE, "Not active");
        require(listing.listingType == ListingType.AUCTION, "Not auction");
        require(block.timestamp >= listing.expiresAt, "Not ended yet");

        if (listing.highestBidder == address(0)) {
            // No bids — cancel
            listing.status = ListingStatus.EXPIRED;
            tokenToListing[listing.tokenId] = 0;
            emit ListingCancelled(listingId);
            return;
        }

        listing.status = ListingStatus.SOLD;
        tokenToListing[listing.tokenId] = 0;

        // Clear winner's bid deposit
        bidDeposits[listingId][listing.highestBidder] = 0;

        _executeSale(listing.tokenId, listing.seller, listing.highestBidder, listing.highestBid);

        emit AuctionFinalized(listingId, listing.highestBidder, listing.highestBid);
    }

    // ---------------------------------------------------------------
    // CANCEL
    // ---------------------------------------------------------------

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.ACTIVE, "Not active");
        require(msg.sender == listing.seller || msg.sender == owner(), "Not authorized");

        if (listing.listingType == ListingType.AUCTION) {
            require(listing.highestBidder == address(0), "Has bids - cannot cancel");
        }

        listing.status = ListingStatus.CANCELLED;
        tokenToListing[listing.tokenId] = 0;

        emit ListingCancelled(listingId);
    }

    // ---------------------------------------------------------------
    // INTERNAL
    // ---------------------------------------------------------------

    function _executeSale(uint256 tokenId, address seller, address buyer, uint256 salePrice) internal {
        // Get royalty info (ERC-2981)
        uint256 royaltyAmount = 0;
        address royaltyReceiver = address(0);

        try IERC2981(address(agentNFT)).royaltyInfo(tokenId, salePrice) returns (address receiver, uint256 amount) {
            royaltyReceiver = receiver;
            royaltyAmount = amount;
        } catch {}

        // Platform fee
        uint256 platformFee = (salePrice * platformFeeBps) / 10000;

        // Seller payout
        uint256 sellerPayout = salePrice - royaltyAmount - platformFee;

        // Transfer NFT (verify it succeeds)
        agentNFT.transferFrom(seller, buyer, tokenId);
        require(agentNFT.ownerOf(tokenId) == buyer, "NFT transfer failed");

        // Distribute funds
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool royaltySent, ) = royaltyReceiver.call{value: royaltyAmount}("");
            require(royaltySent, "Royalty transfer failed");
        }

        if (platformFee > 0) {
            (bool feeSent, ) = treasury.call{value: platformFee}("");
            require(feeSent, "Platform fee transfer failed");
        }

        (bool sellerSent, ) = seller.call{value: sellerPayout}("");
        require(sellerSent, "Seller payout failed");
    }

    // ---------------------------------------------------------------
    // READ
    // ---------------------------------------------------------------

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function getActiveListingForToken(uint256 tokenId) external view returns (uint256) {
        return tokenToListing[tokenId];
    }

    // ---------------------------------------------------------------
    // OWNER SETTERS — PAISLEY RULE
    // ---------------------------------------------------------------

    function setAgentNFT(address _addr) external onlyOwner { agentNFT = IERC721(_addr); }
    function setTreasury(address _addr) external onlyOwner { require(_addr != address(0)); treasury = _addr; }
    function setPlatformFeeBps(uint256 _bps) external onlyOwner { require(_bps <= MAX_FEE_BPS); platformFeeBps = _bps; }
    function setMinAuctionDuration(uint64 _dur) external onlyOwner { minAuctionDuration = _dur; }
    function setMaxAuctionDuration(uint64 _dur) external onlyOwner { maxAuctionDuration = _dur; }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function rescueETH(address to) external onlyOwner {
        (bool sent, ) = to.call{value: address(this).balance}("");
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
}
