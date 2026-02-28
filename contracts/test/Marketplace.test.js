const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Marketplace", function () {
  async function deployFixture() {
    const [owner, treasury, alice, bob, carol] = await ethers.getSigners();

    const AgentNFT = await ethers.getContractFactory("AgentNFT");
    const agentNFT = await AgentNFT.deploy(treasury.address, "https://api.nftagents.io/metadata/", 500);

    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(
      await agentNFT.getAddress(),
      treasury.address
    );

    await agentNFT.setMarketplaceContract(await marketplace.getAddress());

    return { agentNFT, marketplace, owner, treasury, alice, bob, carol };
  }

  async function listedFixedPriceFixture() {
    const fixture = await deployFixture();
    const { agentNFT, marketplace, alice } = fixture;

    // Mint agent for alice
    await agentNFT.connect(alice).mintStarter(0); // Token 1
    // Approve marketplace
    await agentNFT.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
    // List at 10 ETH
    await marketplace.connect(alice).listFixedPrice(1, ethers.parseEther("10"));

    return fixture;
  }

  describe("Deployment", function () {
    it("should set AgentNFT and treasury", async function () {
      const { agentNFT, marketplace, treasury } = await loadFixture(deployFixture);
      expect(await marketplace.agentNFT()).to.equal(await agentNFT.getAddress());
      expect(await marketplace.treasury()).to.equal(treasury.address);
    });

    it("should set default platform fee at 2%", async function () {
      const { marketplace } = await loadFixture(deployFixture);
      expect(await marketplace.platformFeeBps()).to.equal(200);
    });

    it("should revert with zero addresses", async function () {
      const Marketplace = await ethers.getContractFactory("Marketplace");
      await expect(
        Marketplace.deploy(ethers.ZeroAddress, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });

  describe("List Fixed Price", function () {
    it("should list a token for fixed price", async function () {
      const { agentNFT, marketplace, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(alice).listFixedPrice(1, ethers.parseEther("10"));

      const listing = await marketplace.getListing(1);
      expect(listing.seller).to.equal(alice.address);
      expect(listing.price).to.equal(ethers.parseEther("10"));
      expect(listing.listingType).to.equal(0); // FIXED_PRICE
      expect(listing.status).to.equal(0); // ACTIVE
    });

    it("should emit Listed event", async function () {
      const { agentNFT, marketplace, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);

      await expect(marketplace.connect(alice).listFixedPrice(1, ethers.parseEther("10")))
        .to.emit(marketplace, "Listed");
    });

    it("should revert if not token owner", async function () {
      const { agentNFT, marketplace, alice, bob } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);

      await expect(
        marketplace.connect(bob).listFixedPrice(1, ethers.parseEther("10"))
      ).to.be.revertedWith("Not owner");
    });

    it("should revert if not approved", async function () {
      const { agentNFT, marketplace, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);

      await expect(
        marketplace.connect(alice).listFixedPrice(1, ethers.parseEther("10"))
      ).to.be.revertedWith("Must use setApprovalForAll");
    });

    it("should revert with zero price", async function () {
      const { agentNFT, marketplace, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);

      await expect(
        marketplace.connect(alice).listFixedPrice(1, 0)
      ).to.be.revertedWith("Price must be > 0");
    });

    it("should revert if already listed", async function () {
      const { marketplace, alice } = await loadFixture(listedFixedPriceFixture);

      await expect(
        marketplace.connect(alice).listFixedPrice(1, ethers.parseEther("20"))
      ).to.be.revertedWith("Already listed");
    });
  });

  describe("Buy (Fixed Price)", function () {
    it("should buy a listed token", async function () {
      const { agentNFT, marketplace, alice, bob } = await loadFixture(listedFixedPriceFixture);

      await marketplace.connect(bob).buy(1, { value: ethers.parseEther("10") });

      expect(await agentNFT.ownerOf(1)).to.equal(bob.address);

      const listing = await marketplace.getListing(1);
      expect(listing.status).to.equal(1); // SOLD
    });

    it("should distribute funds correctly (seller, royalty, platform)", async function () {
      const { marketplace, treasury, alice, bob } = await loadFixture(listedFixedPriceFixture);

      const price = ethers.parseEther("10");
      const royalty = price * 500n / 10000n; // 5% = 0.5 ETH (goes to treasury since that's the royalty receiver)
      const platformFee = price * 200n / 10000n; // 2% = 0.2 ETH
      const sellerPayout = price - royalty - platformFee; // 9.3 ETH

      // Treasury gets both royalty and platform fee since treasury is royalty receiver
      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      const aliceBalBefore = await ethers.provider.getBalance(alice.address);

      await marketplace.connect(bob).buy(1, { value: ethers.parseEther("10") });

      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
      const aliceBalAfter = await ethers.provider.getBalance(alice.address);

      expect(treasuryBalAfter - treasuryBalBefore).to.equal(royalty + platformFee);
      expect(aliceBalAfter - aliceBalBefore).to.equal(sellerPayout);
    });

    it("should refund excess payment", async function () {
      const { marketplace, bob } = await loadFixture(listedFixedPriceFixture);

      const balBefore = await ethers.provider.getBalance(bob.address);
      const tx = await marketplace.connect(bob).buy(1, { value: ethers.parseEther("15") });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(bob.address);

      // Should have paid 10 ETH + gas
      expect(balBefore - balAfter - gasUsed).to.equal(ethers.parseEther("10"));
    });

    it("should emit Sold event", async function () {
      const { marketplace, alice, bob } = await loadFixture(listedFixedPriceFixture);

      await expect(marketplace.connect(bob).buy(1, { value: ethers.parseEther("10") }))
        .to.emit(marketplace, "Sold");
    });

    it("should revert if insufficient payment", async function () {
      const { marketplace, bob } = await loadFixture(listedFixedPriceFixture);

      await expect(
        marketplace.connect(bob).buy(1, { value: ethers.parseEther("9") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("should revert if buying own listing", async function () {
      const { marketplace, alice } = await loadFixture(listedFixedPriceFixture);

      await expect(
        marketplace.connect(alice).buy(1, { value: ethers.parseEther("10") })
      ).to.be.revertedWith("Cannot buy own listing");
    });

    it("should revert buying non-active listing", async function () {
      const { marketplace, bob, carol } = await loadFixture(listedFixedPriceFixture);

      await marketplace.connect(bob).buy(1, { value: ethers.parseEther("10") });

      await expect(
        marketplace.connect(carol).buy(1, { value: ethers.parseEther("10") })
      ).to.be.revertedWith("Not active");
    });
  });

  describe("Auction", function () {
    async function auctionFixture() {
      const fixture = await deployFixture();
      const { agentNFT, marketplace, alice } = fixture;

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(alice).listAuction(1, ethers.parseEther("5"), 3600);

      return fixture;
    }

    it("should list token for auction", async function () {
      const { marketplace } = await loadFixture(auctionFixture);

      const listing = await marketplace.getListing(1);
      expect(listing.listingType).to.equal(1); // AUCTION
      expect(listing.price).to.equal(ethers.parseEther("5"));
      expect(listing.status).to.equal(0); // ACTIVE
    });

    it("should revert auction with invalid duration", async function () {
      const { agentNFT, marketplace, bob } = await loadFixture(deployFixture);

      await agentNFT.connect(bob).mintStarter(1);
      await agentNFT.connect(bob).setApprovalForAll(await marketplace.getAddress(), true);

      await expect(
        marketplace.connect(bob).listAuction(1, ethers.parseEther("5"), 60) // too short (min 1 hour)
      ).to.be.revertedWith("Invalid duration");
    });

    it("should place a bid", async function () {
      const { marketplace, bob } = await loadFixture(auctionFixture);

      await marketplace.connect(bob).bid(1, { value: ethers.parseEther("5") });

      const listing = await marketplace.getListing(1);
      expect(listing.highestBid).to.equal(ethers.parseEther("5"));
      expect(listing.highestBidder).to.equal(bob.address);
    });

    it("should emit BidPlaced event", async function () {
      const { marketplace, bob } = await loadFixture(auctionFixture);

      await expect(marketplace.connect(bob).bid(1, { value: ethers.parseEther("5") }))
        .to.emit(marketplace, "BidPlaced");
    });

    it("should revert bid below starting price", async function () {
      const { marketplace, bob } = await loadFixture(auctionFixture);

      await expect(
        marketplace.connect(bob).bid(1, { value: ethers.parseEther("4") })
      ).to.be.revertedWith("Below starting price");
    });

    it("should revert bid from seller", async function () {
      const { marketplace, alice } = await loadFixture(auctionFixture);

      await expect(
        marketplace.connect(alice).bid(1, { value: ethers.parseEther("5") })
      ).to.be.revertedWith("Cannot bid on own");
    });

    it("should allow outbidding", async function () {
      const { marketplace, bob, carol } = await loadFixture(auctionFixture);

      await marketplace.connect(bob).bid(1, { value: ethers.parseEther("5") });
      await marketplace.connect(carol).bid(1, { value: ethers.parseEther("8") });

      const listing = await marketplace.getListing(1);
      expect(listing.highestBidder).to.equal(carol.address);
      expect(listing.highestBid).to.equal(ethers.parseEther("8"));
    });

    it("should allow bidder to withdraw (if not highest)", async function () {
      const { marketplace, bob, carol } = await loadFixture(auctionFixture);

      await marketplace.connect(bob).bid(1, { value: ethers.parseEther("5") });
      await marketplace.connect(carol).bid(1, { value: ethers.parseEther("8") });

      const balBefore = await ethers.provider.getBalance(bob.address);
      const tx = await marketplace.connect(bob).withdrawBid(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(bob.address);

      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("5"));
    });

    it("should prevent highest bidder from withdrawing", async function () {
      const { marketplace, bob } = await loadFixture(auctionFixture);

      await marketplace.connect(bob).bid(1, { value: ethers.parseEther("5") });

      await expect(
        marketplace.connect(bob).withdrawBid(1)
      ).to.be.revertedWith("Highest bidder cannot withdraw");
    });

    it("should finalize auction and transfer NFT", async function () {
      const { agentNFT, marketplace, bob } = await loadFixture(auctionFixture);

      await marketplace.connect(bob).bid(1, { value: ethers.parseEther("10") });

      // Advance time past auction end
      await time.increase(3601);

      await marketplace.finalizeAuction(1);

      expect(await agentNFT.ownerOf(1)).to.equal(bob.address);
      const listing = await marketplace.getListing(1);
      expect(listing.status).to.equal(1); // SOLD
    });

    it("should emit AuctionFinalized event", async function () {
      const { marketplace, bob } = await loadFixture(auctionFixture);

      await marketplace.connect(bob).bid(1, { value: ethers.parseEther("10") });
      await time.increase(3601);

      await expect(marketplace.finalizeAuction(1))
        .to.emit(marketplace, "AuctionFinalized");
    });

    it("should expire auction with no bids", async function () {
      const { marketplace } = await loadFixture(auctionFixture);

      await time.increase(3601);
      await marketplace.finalizeAuction(1);

      const listing = await marketplace.getListing(1);
      expect(listing.status).to.equal(3); // EXPIRED
    });

    it("should revert finalize before auction ends", async function () {
      const { marketplace, bob } = await loadFixture(auctionFixture);

      await marketplace.connect(bob).bid(1, { value: ethers.parseEther("10") });

      await expect(
        marketplace.finalizeAuction(1)
      ).to.be.revertedWith("Not ended yet");
    });

    it("should revert bid after auction ends", async function () {
      const { marketplace, bob } = await loadFixture(auctionFixture);

      await time.increase(3601);

      await expect(
        marketplace.connect(bob).bid(1, { value: ethers.parseEther("10") })
      ).to.be.revertedWith("Auction ended");
    });
  });

  describe("Cancel Listing", function () {
    it("should cancel a fixed price listing", async function () {
      const { marketplace, alice } = await loadFixture(listedFixedPriceFixture);

      await marketplace.connect(alice).cancelListing(1);

      const listing = await marketplace.getListing(1);
      expect(listing.status).to.equal(2); // CANCELLED
    });

    it("should emit ListingCancelled event", async function () {
      const { marketplace, alice } = await loadFixture(listedFixedPriceFixture);

      await expect(marketplace.connect(alice).cancelListing(1))
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(1);
    });

    it("should prevent cancelling auction with bids", async function () {
      const { agentNFT, marketplace, alice, bob } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(alice).listAuction(1, ethers.parseEther("5"), 3600);
      await marketplace.connect(bob).bid(1, { value: ethers.parseEther("5") });

      await expect(
        marketplace.connect(alice).cancelListing(1)
      ).to.be.revertedWith("Has bids - cannot cancel");
    });

    it("should allow cancelling auction with no bids", async function () {
      const { agentNFT, marketplace, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);
      await marketplace.connect(alice).listAuction(1, ethers.parseEther("5"), 3600);

      await marketplace.connect(alice).cancelListing(1);
      const listing = await marketplace.getListing(1);
      expect(listing.status).to.equal(2); // CANCELLED
    });

    it("should revert if not seller or owner", async function () {
      const { marketplace, bob } = await loadFixture(listedFixedPriceFixture);

      await expect(
        marketplace.connect(bob).cancelListing(1)
      ).to.be.revertedWith("Not authorized");
    });

    it("should allow owner to cancel any listing", async function () {
      const { marketplace, owner } = await loadFixture(listedFixedPriceFixture);

      await marketplace.connect(owner).cancelListing(1);
      const listing = await marketplace.getListing(1);
      expect(listing.status).to.equal(2);
    });

    it("should clear tokenToListing on cancel", async function () {
      const { marketplace, alice } = await loadFixture(listedFixedPriceFixture);

      await marketplace.connect(alice).cancelListing(1);
      expect(await marketplace.getActiveListingForToken(1)).to.equal(0);
    });
  });

  describe("Owner Setters", function () {
    it("should set platform fee", async function () {
      const { marketplace } = await loadFixture(deployFixture);
      await marketplace.setPlatformFeeBps(500);
      expect(await marketplace.platformFeeBps()).to.equal(500);
    });

    it("should reject fee above ceiling", async function () {
      const { marketplace } = await loadFixture(deployFixture);
      await expect(marketplace.setPlatformFeeBps(3001)).to.be.reverted;
    });

    it("should set auction duration limits", async function () {
      const { marketplace } = await loadFixture(deployFixture);
      await marketplace.setMinAuctionDuration(1800);
      await marketplace.setMaxAuctionDuration(60 * 24 * 60 * 60);
      expect(await marketplace.minAuctionDuration()).to.equal(1800);
      expect(await marketplace.maxAuctionDuration()).to.equal(60 * 24 * 60 * 60);
    });

    it("should pause and unpause", async function () {
      const { agentNFT, marketplace, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.connect(alice).setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.pause();
      await expect(
        marketplace.connect(alice).listFixedPrice(1, ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(marketplace, "EnforcedPause");

      await marketplace.unpause();
      await marketplace.connect(alice).listFixedPrice(1, ethers.parseEther("10"));
    });
  });
});
