const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("BattleArena", function () {
  async function deployFixture() {
    const [owner, treasury, oracle, alice, bob, carol] = await ethers.getSigners();

    const AgentNFT = await ethers.getContractFactory("AgentNFT");
    const agentNFT = await AgentNFT.deploy(treasury.address, "https://api.nftagents.io/metadata/", 500);

    const Evolution = await ethers.getContractFactory("Evolution");
    const evolution = await Evolution.deploy(await agentNFT.getAddress());
    await agentNFT.setEvolutionContract(await evolution.getAddress());

    const BattleArena = await ethers.getContractFactory("BattleArena");
    const battle = await BattleArena.deploy(
      await agentNFT.getAddress(),
      await evolution.getAddress(),
      treasury.address,
      oracle.address
    );
    await agentNFT.setBattleContract(await battle.getAddress());

    // Authorize battle arena as reporter on evolution
    await evolution.setAuthorizedReporter(await battle.getAddress(), true);

    return { agentNFT, evolution, battle, owner, treasury, oracle, alice, bob, carol };
  }

  async function readyToBattleFixture() {
    const fixture = await deployFixture();
    const { agentNFT, evolution, alice, bob } = fixture;

    // Mint and hatch agents for alice (token 1) and bob (token 2)
    await agentNFT.connect(alice).mintStarter(0); // FIRE, already BABY
    await agentNFT.connect(bob).mintStarter(1);   // WATER, already BABY

    return fixture;
  }

  describe("Deployment", function () {
    it("should set all addresses", async function () {
      const { battle, agentNFT, evolution, treasury, oracle } = await loadFixture(deployFixture);
      expect(await battle.agentNFT()).to.equal(await agentNFT.getAddress());
      expect(await battle.evolution()).to.equal(await evolution.getAddress());
      expect(await battle.treasury()).to.equal(treasury.address);
      expect(await battle.oracle()).to.equal(oracle.address);
    });

    it("should set default platform fee at 10%", async function () {
      const { battle } = await loadFixture(deployFixture);
      expect(await battle.platformFeeBps()).to.equal(1000);
    });

    it("should set default XP rewards", async function () {
      const { battle } = await loadFixture(deployFixture);
      expect(await battle.winXP()).to.equal(25);
      expect(await battle.loseXP()).to.equal(5);
    });

    it("should revert with zero addresses", async function () {
      const [, , , alice] = await ethers.getSigners();
      const BattleArena = await ethers.getContractFactory("BattleArena");
      await expect(
        BattleArena.deploy(ethers.ZeroAddress, alice.address, alice.address, alice.address)
      ).to.be.revertedWith("Invalid address");
    });
  });

  describe("Create Battle", function () {
    it("should create a battle", async function () {
      const { battle, alice } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });

      const b = await battle.getBattle(1);
      expect(b.challenger).to.equal(alice.address);
      expect(b.challengerTokenId).to.equal(1);
      expect(b.entryFee).to.equal(ethers.parseEther("1"));
      expect(b.status).to.equal(0); // OPEN
      expect(b.duration).to.equal(3600);
    });

    it("should emit BattleCreated event", async function () {
      const { battle, alice } = await loadFixture(readyToBattleFixture);

      await expect(
        battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") })
      ).to.emit(battle, "BattleCreated");
    });

    it("should revert if not token owner", async function () {
      const { battle, bob } = await loadFixture(readyToBattleFixture);

      await expect(
        battle.connect(bob).createBattle(0, 1, 3600, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Not owner");
    });

    it("should revert if agent not hatched", async function () {
      const { agentNFT, battle, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });

      await expect(
        battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Must be hatched");
    });

    it("should revert if entry fee too low", async function () {
      const { battle, alice } = await loadFixture(readyToBattleFixture);

      await expect(
        battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Invalid entry fee");
    });

    it("should revert if entry fee too high", async function () {
      const { battle, alice } = await loadFixture(readyToBattleFixture);

      // Set a low max to test without needing massive balances
      await battle.setMaxEntryFee(ethers.parseEther("5"));

      await expect(
        battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("6") })
      ).to.be.revertedWith("Invalid entry fee");
    });

    it("should revert if already in battle", async function () {
      const { battle, alice } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
      await expect(
        battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Already in battle");
    });

    it("should revert if duration too short", async function () {
      const { battle, alice } = await loadFixture(readyToBattleFixture);

      await expect(
        battle.connect(alice).createBattle(0, 1, 30, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Duration 1min-7days");
    });

    it("should revert if duration too long", async function () {
      const { battle, alice } = await loadFixture(readyToBattleFixture);

      await expect(
        battle.connect(alice).createBattle(0, 1, 604801, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Duration 1min-7days");
    });
  });

  describe("Join Battle", function () {
    it("should join a battle", async function () {
      const { battle, alice, bob } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
      await battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("1") });

      const b = await battle.getBattle(1);
      expect(b.opponent).to.equal(bob.address);
      expect(b.opponentTokenId).to.equal(2);
      expect(b.status).to.equal(1); // ACTIVE
    });

    it("should emit BattleJoined event", async function () {
      const { battle, alice, bob } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });

      await expect(
        battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("1") })
      ).to.emit(battle, "BattleJoined");
    });

    it("should refund excess payment", async function () {
      const { battle, alice, bob } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });

      const balBefore = await ethers.provider.getBalance(bob.address);
      const tx = await battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("2") });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(bob.address);

      // Should have paid exactly 1 ETH + gas
      expect(balBefore - balAfter - gasUsed).to.equal(ethers.parseEther("1"));
    });

    it("should revert if battle not open", async function () {
      const { agentNFT, battle, alice, bob, carol } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
      await battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("1") });

      // Mint a third agent for carol so she can try to join
      await agentNFT.connect(carol).mintStarter(2); // Token 3

      // battle is now ACTIVE, carol cannot join
      await expect(
        battle.connect(carol).joinBattle(1, 3, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Not open");
    });

    it("should revert if fighting yourself", async function () {
      const { agentNFT, battle, alice } = await loadFixture(readyToBattleFixture);

      // Give alice another agent
      await agentNFT.connect(alice).mint(1, 0, { value: ethers.parseEther("10") }); // token 3

      // Hatch token 3 using owner (authorized)
      await agentNFT.setEvolutionStage(3, 1);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });

      await expect(
        battle.connect(alice).joinBattle(1, 3, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Cannot fight yourself");
    });

    it("should revert with insufficient entry fee", async function () {
      const { battle, alice, bob } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("5") });

      await expect(
        battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("4") })
      ).to.be.revertedWith("Insufficient entry fee");
    });
  });

  describe("Report Result", function () {
    it("should complete battle and distribute rewards", async function () {
      const { battle, treasury, alice, bob, oracle } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
      await battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("1") });

      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      const aliceBalBefore = await ethers.provider.getBalance(alice.address);

      await battle.connect(oracle).reportResult(1, 1); // Alice's token wins

      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
      const aliceBalAfter = await ethers.provider.getBalance(alice.address);

      // Total pot = 2 ETH, platform cut = 10% = 0.2 ETH, winner gets 1.8 ETH
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(ethers.parseEther("0.2"));
      expect(aliceBalAfter - aliceBalBefore).to.equal(ethers.parseEther("1.8"));

      // Verify battle completed
      const b = await battle.getBattle(1);
      expect(b.status).to.equal(2); // COMPLETED
      expect(b.winnerId).to.equal(1);
    });

    it("should update leaderboard", async function () {
      const { battle, alice, bob, oracle } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
      await battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("1") });
      await battle.connect(oracle).reportResult(1, 1);

      const winnerLb = await battle.getLeaderboard(1);
      expect(winnerLb.wins).to.equal(1);
      expect(winnerLb.currentStreak).to.equal(1);

      const loserLb = await battle.getLeaderboard(2);
      expect(loserLb.losses).to.equal(1);
      expect(loserLb.currentStreak).to.equal(0);
    });

    it("should emit BattleCompleted event", async function () {
      const { battle, alice, bob, oracle } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
      await battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("1") });

      await expect(battle.connect(oracle).reportResult(1, 1))
        .to.emit(battle, "BattleCompleted")
        .withArgs(1, 1, 2);
    });

    it("should revert if not oracle", async function () {
      const { battle, alice, bob } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
      await battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("1") });

      await expect(
        battle.connect(alice).reportResult(1, 1)
      ).to.be.revertedWith("Not oracle");
    });

    it("should revert if battle not active", async function () {
      const { battle, alice, oracle } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });

      await expect(
        battle.connect(oracle).reportResult(1, 1)
      ).to.be.revertedWith("Not active");
    });

    it("should revert with invalid winner", async function () {
      const { battle, alice, bob, oracle } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
      await battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("1") });

      await expect(
        battle.connect(oracle).reportResult(1, 99)
      ).to.be.revertedWith("Invalid winner");
    });

    it("should clear active battles after result", async function () {
      const { battle, alice, bob, oracle } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
      await battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("1") });
      await battle.connect(oracle).reportResult(1, 1);

      expect(await battle.activeBattle(1)).to.equal(0);
      expect(await battle.activeBattle(2)).to.equal(0);
    });
  });

  describe("Cancel Battle", function () {
    it("should cancel and refund challenger", async function () {
      const { battle, alice } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("5") });

      const balBefore = await ethers.provider.getBalance(alice.address);
      const tx = await battle.connect(alice).cancelBattle(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(alice.address);

      expect(balAfter - balBefore + gasUsed).to.equal(ethers.parseEther("5"));

      const b = await battle.getBattle(1);
      expect(b.status).to.equal(3); // CANCELLED
    });

    it("should emit BattleCancelled event", async function () {
      const { battle, alice } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });

      await expect(battle.connect(alice).cancelBattle(1))
        .to.emit(battle, "BattleCancelled")
        .withArgs(1);
    });

    it("should revert if not challenger or owner", async function () {
      const { battle, alice, bob } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });

      await expect(
        battle.connect(bob).cancelBattle(1)
      ).to.be.revertedWith("Not authorized");
    });

    it("should revert if battle not open", async function () {
      const { battle, alice, bob, oracle } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
      await battle.connect(bob).joinBattle(1, 2, { value: ethers.parseEther("1") });

      await expect(
        battle.connect(alice).cancelBattle(1)
      ).to.be.revertedWith("Not open");
    });

    it("should allow owner to cancel any battle", async function () {
      const { battle, owner, alice } = await loadFixture(readyToBattleFixture);

      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });

      await expect(battle.connect(owner).cancelBattle(1))
        .to.emit(battle, "BattleCancelled");
    });
  });

  describe("Owner Setters", function () {
    it("should set platform fee", async function () {
      const { battle } = await loadFixture(deployFixture);
      await battle.setPlatformFeeBps(500);
      expect(await battle.platformFeeBps()).to.equal(500);
    });

    it("should reject fee above ceiling", async function () {
      const { battle } = await loadFixture(deployFixture);
      await expect(battle.setPlatformFeeBps(3001)).to.be.reverted;
    });

    it("should set win/lose XP", async function () {
      const { battle } = await loadFixture(deployFixture);
      await battle.setWinXP(50);
      await battle.setLoseXP(10);
      expect(await battle.winXP()).to.equal(50);
      expect(await battle.loseXP()).to.equal(10);
    });

    it("should set entry fee bounds", async function () {
      const { battle } = await loadFixture(deployFixture);
      await battle.setMinEntryFee(ethers.parseEther("2"));
      await battle.setMaxEntryFee(ethers.parseEther("5000"));
      expect(await battle.minEntryFee()).to.equal(ethers.parseEther("2"));
      expect(await battle.maxEntryFee()).to.equal(ethers.parseEther("5000"));
    });

    it("should pause and unpause", async function () {
      const { battle, alice } = await loadFixture(readyToBattleFixture);

      await battle.pause();
      await expect(
        battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(battle, "EnforcedPause");

      await battle.unpause();
      await battle.connect(alice).createBattle(0, 1, 3600, { value: ethers.parseEther("1") });
    });
  });
});
