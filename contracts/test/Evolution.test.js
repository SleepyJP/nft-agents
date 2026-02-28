const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Evolution", function () {
  async function deployFixture() {
    const [owner, treasury, alice, bob, reporter] = await ethers.getSigners();

    const AgentNFT = await ethers.getContractFactory("AgentNFT");
    const agentNFT = await AgentNFT.deploy(
      treasury.address,
      "https://api.nftagents.io/metadata/",
      500
    );

    const Evolution = await ethers.getContractFactory("Evolution");
    const evolution = await Evolution.deploy(await agentNFT.getAddress());

    // Register evolution contract as authorized on AgentNFT
    await agentNFT.setEvolutionContract(await evolution.getAddress());

    // Authorize reporter
    await evolution.setAuthorizedReporter(reporter.address, true);

    return { agentNFT, evolution, owner, treasury, alice, bob, reporter };
  }

  async function mintAndHatchFixture() {
    const fixture = await deployFixture();
    const { agentNFT, evolution, alice } = fixture;

    // Mint an egg (tier 0 = COMMON, element 0 = FIRE)
    await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });

    // Hatch it
    await evolution.connect(alice).hatch(1);

    return fixture;
  }

  describe("Deployment", function () {
    it("should set AgentNFT address", async function () {
      const { agentNFT, evolution } = await loadFixture(deployFixture);
      expect(await evolution.agentNFT()).to.equal(await agentNFT.getAddress());
    });

    it("should set default XP rewards", async function () {
      const { evolution } = await loadFixture(deployFixture);
      expect(await evolution.xpRewards("task_completed")).to.equal(10);
      expect(await evolution.xpRewards("battle_win")).to.equal(25);
      expect(await evolution.xpRewards("battle_loss")).to.equal(5);
      expect(await evolution.xpRewards("tool_call")).to.equal(2);
    });

    it("should set default evolution thresholds", async function () {
      const { evolution } = await loadFixture(deployFixture);
      expect(await evolution.evolutionXPThresholds(2)).to.equal(100);
      expect(await evolution.evolutionXPThresholds(3)).to.equal(500);
      expect(await evolution.evolutionXPThresholds(4)).to.equal(2000);
      expect(await evolution.evolutionXPThresholds(5)).to.equal(5000);
    });

    it("should revert with zero AgentNFT address", async function () {
      const Evolution = await ethers.getContractFactory("Evolution");
      await expect(
        Evolution.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid AgentNFT");
    });
  });

  describe("Hatching (EGG -> BABY)", function () {
    it("should hatch an egg", async function () {
      const { agentNFT, evolution, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });
      await evolution.connect(alice).hatch(1);

      const agent = await agentNFT.getAgent(1);
      expect(agent.evolutionStage).to.equal(1); // BABY
      expect(agent.level).to.equal(1);
    });

    it("should emit Hatched and Evolved events", async function () {
      const { agentNFT, evolution, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });

      await expect(evolution.connect(alice).hatch(1))
        .to.emit(evolution, "Hatched")
        .withArgs(1, alice.address)
        .and.to.emit(evolution, "Evolved")
        .withArgs(1, 0, 1, 1);
    });

    it("should revert if not owner", async function () {
      const { agentNFT, evolution, alice, bob } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });
      await expect(
        evolution.connect(bob).hatch(1)
      ).to.be.revertedWith("Not owner");
    });

    it("should revert if already hatched", async function () {
      const { agentNFT, evolution, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0); // Starters are already BABY
      await expect(
        evolution.connect(alice).hatch(1)
      ).to.be.revertedWith("Not an egg");
    });
  });

  describe("XP & Leveling", function () {
    it("should award XP from authorized reporter", async function () {
      const { agentNFT, evolution, reporter } = await loadFixture(mintAndHatchFixture);

      await evolution.connect(reporter).awardXP(1, "task_completed", 1);

      const agent = await agentNFT.getAgent(1);
      expect(agent.xp).to.equal(10); // 10 XP per task_completed
    });

    it("should award XP with multiplier", async function () {
      const { agentNFT, evolution, reporter } = await loadFixture(mintAndHatchFixture);

      await evolution.connect(reporter).awardXP(1, "task_completed", 3);

      const agent = await agentNFT.getAgent(1);
      expect(agent.xp).to.equal(30); // 10 * 3
    });

    it("should level up when XP threshold reached", async function () {
      const { agentNFT, evolution, reporter } = await loadFixture(mintAndHatchFixture);

      // Award 30 XP (should reach level 3: 30/10 = 3)
      await evolution.connect(reporter).awardXP(1, "task_completed", 3);

      const agent = await agentNFT.getAgent(1);
      expect(agent.level).to.equal(3);
    });

    it("should emit LevelUp event on level change", async function () {
      const { evolution, reporter } = await loadFixture(mintAndHatchFixture);

      await expect(
        evolution.connect(reporter).awardXP(1, "battle_win", 1)
      ).to.emit(evolution, "LevelUp");
    });

    it("should emit XPAwarded event", async function () {
      const { evolution, reporter } = await loadFixture(mintAndHatchFixture);

      await expect(
        evolution.connect(reporter).awardXP(1, "task_completed", 1)
      ).to.emit(evolution, "XPAwarded")
        .withArgs(1, 10, "task_completed", reporter.address);
    });

    it("should award custom XP amount", async function () {
      const { agentNFT, evolution, reporter } = await loadFixture(mintAndHatchFixture);

      await evolution.connect(reporter).awardCustomXP(1, 250, "custom_reward");

      const agent = await agentNFT.getAgent(1);
      expect(agent.xp).to.equal(250);
    });

    it("should revert unknown XP source", async function () {
      const { evolution, reporter } = await loadFixture(mintAndHatchFixture);

      await expect(
        evolution.connect(reporter).awardXP(1, "fake_source", 1)
      ).to.be.revertedWith("Unknown XP source");
    });

    it("should revert if not reporter", async function () {
      const { evolution, alice } = await loadFixture(mintAndHatchFixture);

      await expect(
        evolution.connect(alice).awardXP(1, "task_completed", 1)
      ).to.be.revertedWith("Not authorized reporter");
    });

    it("should accumulate XP across multiple awards", async function () {
      const { agentNFT, evolution, reporter } = await loadFixture(mintAndHatchFixture);

      await evolution.connect(reporter).awardXP(1, "task_completed", 1); // +10
      await evolution.connect(reporter).awardXP(1, "tool_call", 1); // +2
      await evolution.connect(reporter).awardXP(1, "uptime_hour", 5); // +5

      const agent = await agentNFT.getAgent(1);
      expect(agent.xp).to.equal(17);
    });
  });

  describe("Evolution", function () {
    it("should evolve from BABY to JUVENILE at 100 XP", async function () {
      const { agentNFT, evolution, alice, reporter } = await loadFixture(mintAndHatchFixture);

      // Award 100 XP
      await evolution.connect(reporter).awardCustomXP(1, 100, "xp_boost");

      // Evolve
      await evolution.connect(alice).evolve(1);

      const agent = await agentNFT.getAgent(1);
      expect(agent.evolutionStage).to.equal(2); // JUVENILE
    });

    it("should evolve from JUVENILE to ADULT at 500 XP", async function () {
      const { agentNFT, evolution, alice, reporter } = await loadFixture(mintAndHatchFixture);

      await evolution.connect(reporter).awardCustomXP(1, 500, "xp_boost");
      await evolution.connect(alice).evolve(1); // BABY -> JUVENILE

      await evolution.connect(alice).evolve(1); // JUVENILE -> ADULT
      const agent = await agentNFT.getAgent(1);
      expect(agent.evolutionStage).to.equal(3); // ADULT
    });

    it("should revert evolution with insufficient XP", async function () {
      const { evolution, alice, reporter } = await loadFixture(mintAndHatchFixture);

      await evolution.connect(reporter).awardCustomXP(1, 50, "xp_boost"); // Not enough for JUVENILE (needs 100)

      await expect(
        evolution.connect(alice).evolve(1)
      ).to.be.revertedWith("Insufficient XP");
    });

    it("should revert evolution if still an egg", async function () {
      const { agentNFT, evolution, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });

      await expect(
        evolution.connect(alice).evolve(1)
      ).to.be.revertedWith("Must hatch first");
    });

    it("should revert if already at APEX", async function () {
      const { agentNFT, evolution, alice, reporter } = await loadFixture(mintAndHatchFixture);

      // Push to APEX
      await evolution.connect(reporter).awardCustomXP(1, 5000, "xp_boost");
      await evolution.connect(alice).evolve(1); // -> JUVENILE
      await evolution.connect(alice).evolve(1); // -> ADULT
      await evolution.connect(alice).evolve(1); // -> ALPHA
      await evolution.connect(alice).evolve(1); // -> APEX

      await expect(
        evolution.connect(alice).evolve(1)
      ).to.be.revertedWith("Already at APEX");
    });

    it("should revert if not token owner", async function () {
      const { evolution, bob, reporter } = await loadFixture(mintAndHatchFixture);

      await evolution.connect(reporter).awardCustomXP(1, 100, "xp_boost");

      await expect(
        evolution.connect(bob).evolve(1)
      ).to.be.revertedWith("Not owner");
    });

    it("should report canEvolve correctly", async function () {
      const { evolution, reporter } = await loadFixture(mintAndHatchFixture);

      // Not enough XP
      let [can, nextStage, xpNeeded] = await evolution.canEvolve(1);
      expect(can).to.be.false;
      expect(nextStage).to.equal(2);
      expect(xpNeeded).to.equal(100);

      // Award enough XP
      await evolution.connect(reporter).awardCustomXP(1, 100, "xp_boost");
      [can, nextStage, xpNeeded] = await evolution.canEvolve(1);
      expect(can).to.be.true;
      expect(nextStage).to.equal(2);
      expect(xpNeeded).to.equal(0);
    });

    it("should emit Evolved event", async function () {
      const { evolution, alice, reporter } = await loadFixture(mintAndHatchFixture);

      await evolution.connect(reporter).awardCustomXP(1, 100, "xp_boost");

      await expect(evolution.connect(alice).evolve(1))
        .to.emit(evolution, "Evolved");
    });
  });

  describe("Full Evolution Path", function () {
    it("should evolve through all stages: BABY -> JUVENILE -> ADULT -> ALPHA -> APEX", async function () {
      const { agentNFT, evolution, alice, reporter } = await loadFixture(mintAndHatchFixture);

      // Award enough XP for all stages
      await evolution.connect(reporter).awardCustomXP(1, 5000, "mega_boost");

      // BABY -> JUVENILE (100 XP)
      await evolution.connect(alice).evolve(1);
      expect((await agentNFT.getAgent(1)).evolutionStage).to.equal(2);

      // JUVENILE -> ADULT (500 XP)
      await evolution.connect(alice).evolve(1);
      expect((await agentNFT.getAgent(1)).evolutionStage).to.equal(3);

      // ADULT -> ALPHA (2000 XP)
      await evolution.connect(alice).evolve(1);
      expect((await agentNFT.getAgent(1)).evolutionStage).to.equal(4);

      // ALPHA -> APEX (5000 XP)
      await evolution.connect(alice).evolve(1);
      expect((await agentNFT.getAgent(1)).evolutionStage).to.equal(5);
    });
  });

  describe("Owner Setters", function () {
    it("should update evolution thresholds", async function () {
      const { evolution } = await loadFixture(deployFixture);

      await evolution.setEvolutionThreshold(2, 200);
      expect(await evolution.evolutionXPThresholds(2)).to.equal(200);
    });

    it("should revert invalid threshold stage", async function () {
      const { evolution } = await loadFixture(deployFixture);
      await expect(evolution.setEvolutionThreshold(0, 100)).to.be.revertedWith("Invalid stage");
    });

    it("should update XP per level", async function () {
      const { evolution } = await loadFixture(deployFixture);

      await evolution.setXPPerLevel(20);
      expect(await evolution.xpPerLevel()).to.equal(20);
    });

    it("should revert zero XP per level", async function () {
      const { evolution } = await loadFixture(deployFixture);
      await expect(evolution.setXPPerLevel(0)).to.be.revertedWith("Must be > 0");
    });

    it("should add/remove authorized reporters", async function () {
      const { evolution, bob } = await loadFixture(deployFixture);

      await evolution.setAuthorizedReporter(bob.address, true);
      expect(await evolution.authorizedReporters(bob.address)).to.be.true;

      await evolution.setAuthorizedReporter(bob.address, false);
      expect(await evolution.authorizedReporters(bob.address)).to.be.false;
    });

    it("should set custom XP reward", async function () {
      const { evolution } = await loadFixture(deployFixture);

      await evolution.setXPReward("new_source", 50);
      expect(await evolution.xpRewards("new_source")).to.equal(50);
    });

    it("should pause and unpause", async function () {
      const { evolution, reporter } = await loadFixture(mintAndHatchFixture);

      await evolution.pause();
      await expect(
        evolution.connect(reporter).awardXP(1, "task_completed", 1)
      ).to.be.revertedWithCustomError(evolution, "EnforcedPause");

      await evolution.unpause();
      await evolution.connect(reporter).awardXP(1, "task_completed", 1);
    });
  });
});
