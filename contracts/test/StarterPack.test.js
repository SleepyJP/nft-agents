const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("StarterPack", function () {
  async function deployFixture() {
    const [owner, treasury, alice, bob, carol] = await ethers.getSigners();

    const AgentNFT = await ethers.getContractFactory("AgentNFT");
    const agentNFT = await AgentNFT.deploy(treasury.address, "https://api.nftagents.io/metadata/", 500);

    const StarterPack = await ethers.getContractFactory("StarterPack");
    const starterPack = await StarterPack.deploy(await agentNFT.getAddress());

    // Authorize StarterPack as operator on AgentNFT
    await agentNFT.setAuthorizedOperator(await starterPack.getAddress(), true);

    return { agentNFT, starterPack, owner, treasury, alice, bob, carol };
  }

  describe("Deployment", function () {
    it("should set AgentNFT address", async function () {
      const { agentNFT, starterPack } = await loadFixture(deployFixture);
      expect(await starterPack.agentNFT()).to.equal(await agentNFT.getAddress());
    });

    it("should set default max starters to 5000", async function () {
      const { starterPack } = await loadFixture(deployFixture);
      expect(await starterPack.maxStarters()).to.equal(5000);
    });

    it("should start with zero claimed", async function () {
      const { starterPack } = await loadFixture(deployFixture);
      expect(await starterPack.totalClaimed()).to.equal(0);
    });

    it("should revert with zero address", async function () {
      const StarterPack = await ethers.getContractFactory("StarterPack");
      await expect(
        StarterPack.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });

  describe("Claim Starter", function () {
    it("should claim Embertrade (FIRE) starter", async function () {
      const { agentNFT, starterPack, alice } = await loadFixture(deployFixture);

      await starterPack.connect(alice).claimStarter(0);

      expect(await agentNFT.ownerOf(1)).to.equal(alice.address);
      const agent = await agentNFT.getAgent(1);
      expect(agent.element).to.equal(0); // FIRE
      expect(agent.evolutionStage).to.equal(1); // BABY
      expect(agent.level).to.equal(1);
    });

    it("should claim Aquascan (WATER) starter", async function () {
      const { agentNFT, starterPack, alice } = await loadFixture(deployFixture);

      await starterPack.connect(alice).claimStarter(1);
      const agent = await agentNFT.getAgent(1);
      expect(agent.element).to.equal(1); // WATER
    });

    it("should claim Voltbot (ELECTRIC) starter", async function () {
      const { agentNFT, starterPack, alice } = await loadFixture(deployFixture);

      await starterPack.connect(alice).claimStarter(2);
      const agent = await agentNFT.getAgent(1);
      expect(agent.element).to.equal(2); // ELECTRIC
    });

    it("should increment totalClaimed", async function () {
      const { starterPack, alice, bob } = await loadFixture(deployFixture);

      await starterPack.connect(alice).claimStarter(0);
      expect(await starterPack.totalClaimed()).to.equal(1);

      await starterPack.connect(bob).claimStarter(1);
      expect(await starterPack.totalClaimed()).to.equal(2);
    });

    it("should track per-type counts", async function () {
      const { starterPack, alice, bob, carol } = await loadFixture(deployFixture);

      await starterPack.connect(alice).claimStarter(0); // FIRE
      await starterPack.connect(bob).claimStarter(0); // FIRE
      await starterPack.connect(carol).claimStarter(2); // ELECTRIC

      const counts = await starterPack.getStarterCounts();
      expect(counts[0]).to.equal(2); // 2 FIRE
      expect(counts[1]).to.equal(0); // 0 WATER
      expect(counts[2]).to.equal(1); // 1 ELECTRIC
    });

    it("should track chosen starter per user", async function () {
      const { starterPack, alice } = await loadFixture(deployFixture);

      await starterPack.connect(alice).claimStarter(2);
      expect(await starterPack.chosenStarter(alice.address)).to.equal(2);
    });

    it("should emit StarterClaimed event", async function () {
      const { starterPack, alice } = await loadFixture(deployFixture);

      await expect(starterPack.connect(alice).claimStarter(0))
        .to.emit(starterPack, "StarterClaimed")
        .withArgs(alice.address, 0, 1);
    });

    it("should revert with invalid choice", async function () {
      const { starterPack, alice } = await loadFixture(deployFixture);
      await expect(
        starterPack.connect(alice).claimStarter(3)
      ).to.be.revertedWith("Invalid choice: 0=Embertrade, 1=Aquascan, 2=Voltbot");
    });

    it("should enforce one per wallet", async function () {
      const { starterPack, alice } = await loadFixture(deployFixture);

      await starterPack.connect(alice).claimStarter(0);
      await expect(
        starterPack.connect(alice).claimStarter(1)
      ).to.be.revertedWith("Already claimed");
    });

    it("should enforce max starters cap", async function () {
      const { starterPack } = await loadFixture(deployFixture);

      // Set max to 2 for testing
      await starterPack.setMaxStarters(2);

      const signers = await ethers.getSigners();
      await starterPack.connect(signers[5]).claimStarter(0);
      await starterPack.connect(signers[6]).claimStarter(1);

      await expect(
        starterPack.connect(signers[7]).claimStarter(2)
      ).to.be.revertedWith("All starters claimed");
    });
  });

  describe("canClaim", function () {
    it("should return true for unclaimed user under cap", async function () {
      const { starterPack, alice } = await loadFixture(deployFixture);
      expect(await starterPack.canClaim(alice.address)).to.be.true;
    });

    it("should return false for user who already claimed", async function () {
      const { starterPack, alice } = await loadFixture(deployFixture);

      await starterPack.connect(alice).claimStarter(0);
      expect(await starterPack.canClaim(alice.address)).to.be.false;
    });

    it("should return false when cap reached", async function () {
      const { starterPack } = await loadFixture(deployFixture);

      await starterPack.setMaxStarters(1);
      const signers = await ethers.getSigners();
      await starterPack.connect(signers[5]).claimStarter(0);

      expect(await starterPack.canClaim(signers[6].address)).to.be.false;
    });
  });

  describe("Owner Setters", function () {
    it("should set max starters", async function () {
      const { starterPack } = await loadFixture(deployFixture);
      await starterPack.setMaxStarters(10000);
      expect(await starterPack.maxStarters()).to.equal(10000);
    });

    it("should set AgentNFT address", async function () {
      const { starterPack, alice } = await loadFixture(deployFixture);
      await starterPack.setAgentNFT(alice.address);
      expect(await starterPack.agentNFT()).to.equal(alice.address);
    });

    it("should reject non-owner calls", async function () {
      const { starterPack, alice } = await loadFixture(deployFixture);
      await expect(
        starterPack.connect(alice).setMaxStarters(100)
      ).to.be.revertedWithCustomError(starterPack, "OwnableUnauthorizedAccount");
    });

    it("should pause and unpause", async function () {
      const { starterPack, alice } = await loadFixture(deployFixture);

      await starterPack.pause();
      await expect(
        starterPack.connect(alice).claimStarter(0)
      ).to.be.revertedWithCustomError(starterPack, "EnforcedPause");

      await starterPack.unpause();
      await starterPack.connect(alice).claimStarter(0);
    });
  });
});
