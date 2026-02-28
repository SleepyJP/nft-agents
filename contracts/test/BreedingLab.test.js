const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("BreedingLab", function () {
  async function deployFixture() {
    const [owner, treasury, alice, bob] = await ethers.getSigners();

    const AgentNFT = await ethers.getContractFactory("AgentNFT");
    const agentNFT = await AgentNFT.deploy(treasury.address, "https://api.nftagents.io/metadata/", 500);

    const BreedingLab = await ethers.getContractFactory("BreedingLab");
    const breeding = await BreedingLab.deploy(
      await agentNFT.getAddress(),
      treasury.address
    );

    // Register breeding contract as authorized on AgentNFT
    await agentNFT.setBreedingContract(await breeding.getAddress());

    return { agentNFT, breeding, owner, treasury, alice, bob };
  }

  async function readyToBreedFixture() {
    const fixture = await deployFixture();
    const { agentNFT, alice } = fixture;

    // Mint two agents and evolve them to ADULT (stage 3) - the minimum for breeding
    await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") }); // Token 1 FIRE
    await agentNFT.connect(alice).mint(1, 0, { value: ethers.parseEther("10") }); // Token 2 WATER

    // Set evolution stage to ADULT (3) - owner is authorized
    await agentNFT.setEvolutionStage(1, 3);
    await agentNFT.setEvolutionStage(2, 3);

    return fixture;
  }

  describe("Deployment", function () {
    it("should set AgentNFT and treasury", async function () {
      const { agentNFT, breeding, treasury } = await loadFixture(deployFixture);
      expect(await breeding.agentNFT()).to.equal(await agentNFT.getAddress());
      expect(await breeding.treasury()).to.equal(treasury.address);
    });

    it("should set default breeding fee", async function () {
      const { breeding } = await loadFixture(deployFixture);
      expect(await breeding.breedingFee()).to.equal(ethers.parseEther("25"));
    });

    it("should set default cooldown", async function () {
      const { breeding } = await loadFixture(deployFixture);
      expect(await breeding.breedCooldown()).to.equal(7 * 24 * 60 * 60); // 7 days
    });

    it("should initialize type matrix combos", async function () {
      const { breeding } = await loadFixture(deployFixture);

      // DRAGON + GHOST = GHOST
      expect(await breeding.previewHybridElement(6, 7)).to.equal(7);
      // FIRE + ELECTRIC = ELECTRIC
      expect(await breeding.previewHybridElement(0, 2)).to.equal(2);
      // PSYCHIC + DARK = DARK
      expect(await breeding.previewHybridElement(3, 5)).to.equal(5);
    });

    it("should revert with zero addresses", async function () {
      const BreedingLab = await ethers.getContractFactory("BreedingLab");
      await expect(
        BreedingLab.deploy(ethers.ZeroAddress, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });

  describe("Breeding", function () {
    it("should breed two agents and produce a hybrid", async function () {
      const { agentNFT, breeding, alice } = await loadFixture(readyToBreedFixture);

      await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") });

      // Hybrid should be token 3
      expect(await agentNFT.ownerOf(3)).to.equal(alice.address);

      const child = await agentNFT.getAgent(3);
      expect(child.evolutionStage).to.equal(0); // EGG
      expect(child.parentA).to.equal(1);
      expect(child.parentB).to.equal(2);
    });

    it("should determine correct hybrid element from type matrix", async function () {
      const { agentNFT, breeding, alice } = await loadFixture(readyToBreedFixture);

      // FIRE(0) + WATER(1) = no special combo, defaults to parent A element (FIRE = 0)
      await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") });

      const child = await agentNFT.getAgent(3);
      expect(child.element).to.equal(0); // FIRE (parent A's element)
    });

    it("should use special type combo when defined", async function () {
      const { agentNFT, breeding, alice } = await loadFixture(deployFixture);

      // Mint FIRE(0) and ELECTRIC(2) agents
      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") }); // Token 1
      await agentNFT.connect(alice).mint(2, 0, { value: ethers.parseEther("10") }); // Token 2
      await agentNFT.setEvolutionStage(1, 3);
      await agentNFT.setEvolutionStage(2, 3);

      // FIRE + ELECTRIC = ELECTRIC
      await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") });
      const child = await agentNFT.getAgent(3);
      expect(child.element).to.equal(2); // ELECTRIC
    });

    it("should increment breed counts on parents", async function () {
      const { agentNFT, breeding, alice } = await loadFixture(readyToBreedFixture);

      await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") });

      const parentA = await agentNFT.getAgent(1);
      const parentB = await agentNFT.getAgent(2);
      expect(parentA.breedCount).to.equal(1);
      expect(parentB.breedCount).to.equal(1);
    });

    it("should distribute fee: 50% burn, 50% treasury", async function () {
      const { breeding, treasury, alice } = await loadFixture(readyToBreedFixture);

      const deadAddress = "0x000000000000000000000000000000000000dEaD";
      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);
      const deadBalBefore = await ethers.provider.getBalance(deadAddress);

      await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") });

      const treasuryBalAfter = await ethers.provider.getBalance(treasury.address);
      const deadBalAfter = await ethers.provider.getBalance(deadAddress);

      expect(treasuryBalAfter - treasuryBalBefore).to.equal(ethers.parseEther("12.5"));
      expect(deadBalAfter - deadBalBefore).to.equal(ethers.parseEther("12.5"));
    });

    it("should refund excess payment", async function () {
      const { breeding, alice } = await loadFixture(readyToBreedFixture);

      const balBefore = await ethers.provider.getBalance(alice.address);
      const tx = await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("30") });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(alice.address);

      // Should have spent exactly 25 ETH + gas
      expect(balBefore - balAfter - gasUsed).to.equal(ethers.parseEther("25"));
    });

    it("should emit Bred event", async function () {
      const { breeding, alice } = await loadFixture(readyToBreedFixture);

      await expect(
        breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") })
      ).to.emit(breeding, "Bred")
        .withArgs(1, 2, 3, 0, alice.address);
    });

    it("should return child token ID", async function () {
      const { breeding, alice } = await loadFixture(readyToBreedFixture);

      // Use staticCall to get return value
      const childId = await breeding.connect(alice).breed.staticCall(1, 2, { value: ethers.parseEther("25") });
      expect(childId).to.equal(3);
    });
  });

  describe("Breeding Restrictions", function () {
    it("should revert breeding with self", async function () {
      const { breeding, alice } = await loadFixture(readyToBreedFixture);

      await expect(
        breeding.connect(alice).breed(1, 1, { value: ethers.parseEther("25") })
      ).to.be.revertedWith("Cannot breed with self");
    });

    it("should revert if not owner of both parents", async function () {
      const { breeding, bob } = await loadFixture(readyToBreedFixture);

      await expect(
        breeding.connect(bob).breed(1, 2, { value: ethers.parseEther("25") })
      ).to.be.revertedWith("Not owner of parent A");
    });

    it("should revert if parent not evolved enough", async function () {
      const { agentNFT, breeding, alice } = await loadFixture(deployFixture);

      // Mint two agents at stage 0 (EGG)
      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });
      await agentNFT.connect(alice).mint(1, 0, { value: ethers.parseEther("10") });

      await expect(
        breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") })
      ).to.be.revertedWith("Parent A not evolved enough");
    });

    it("should revert after max breeds reached", async function () {
      const { agentNFT, breeding, alice } = await loadFixture(readyToBreedFixture);

      // Breed 3 times
      for (let i = 0; i < 3; i++) {
        await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") });

        // Advance time past cooldown
        await time.increase(7 * 24 * 60 * 60 + 1);
      }

      // 4th breed should fail
      await expect(
        breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") })
      ).to.be.revertedWith("Parent A max breeds reached");
    });

    it("should enforce cooldown between breeds", async function () {
      const { breeding, alice } = await loadFixture(readyToBreedFixture);

      await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") });

      // Try breeding again immediately
      await expect(
        breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") })
      ).to.be.revertedWith("Parent A on cooldown");
    });

    it("should allow breeding after cooldown expires", async function () {
      const { agentNFT, breeding, alice } = await loadFixture(readyToBreedFixture);

      await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") });

      // Advance time past 7 days
      await time.increase(7 * 24 * 60 * 60 + 1);

      // Should succeed
      await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") });
      expect(await agentNFT.ownerOf(4)).to.equal(alice.address);
    });

    it("should revert with insufficient fee", async function () {
      const { breeding, alice } = await loadFixture(readyToBreedFixture);

      await expect(
        breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("24") })
      ).to.be.revertedWith("Insufficient fee");
    });
  });

  describe("canBreed", function () {
    it("should return true when breeding is valid", async function () {
      const { breeding } = await loadFixture(readyToBreedFixture);

      const [can, reason] = await breeding.canBreed(1, 2);
      expect(can).to.be.true;
      expect(reason).to.equal("");
    });

    it("should return false for same token", async function () {
      const { breeding } = await loadFixture(readyToBreedFixture);

      const [can, reason] = await breeding.canBreed(1, 1);
      expect(can).to.be.false;
      expect(reason).to.equal("Same token");
    });

    it("should return false for unevolved parent", async function () {
      const { agentNFT, breeding, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });
      await agentNFT.connect(alice).mint(1, 0, { value: ethers.parseEther("10") });

      const [can, reason] = await breeding.canBreed(1, 2);
      expect(can).to.be.false;
      expect(reason).to.equal("Parent A not evolved");
    });
  });

  describe("Owner Setters", function () {
    it("should set breeding fee", async function () {
      const { breeding } = await loadFixture(deployFixture);
      await breeding.setBreedingFee(ethers.parseEther("50"));
      expect(await breeding.breedingFee()).to.equal(ethers.parseEther("50"));
    });

    it("should set burn percentage", async function () {
      const { breeding } = await loadFixture(deployFixture);
      await breeding.setBurnPercentage(75);
      expect(await breeding.burnPercentage()).to.equal(75);
    });

    it("should reject burn percentage over 100", async function () {
      const { breeding } = await loadFixture(deployFixture);
      await expect(breeding.setBurnPercentage(101)).to.be.reverted;
    });

    it("should set min evolution stage", async function () {
      const { breeding } = await loadFixture(deployFixture);
      await breeding.setMinEvolutionStage(2);
      expect(await breeding.minEvolutionStage()).to.equal(2);
    });

    it("should set breed cooldown", async function () {
      const { breeding } = await loadFixture(deployFixture);
      await breeding.setBreedCooldown(3 * 24 * 60 * 60);
      expect(await breeding.breedCooldown()).to.equal(3 * 24 * 60 * 60);
    });

    it("should set type combo", async function () {
      const { breeding } = await loadFixture(deployFixture);
      await breeding.setTypeCombo(0, 1, 9); // FIRE + WATER = NATURE
      expect(await breeding.previewHybridElement(0, 1)).to.equal(9);
    });

    it("should remove type combo", async function () {
      const { breeding } = await loadFixture(deployFixture);
      await breeding.removeTypeCombo(6, 7); // Remove DRAGON + GHOST combo
      // Now should default to parent A element (DRAGON = 6)
      expect(await breeding.previewHybridElement(6, 7)).to.equal(6);
    });

    it("should pause and unpause", async function () {
      const { breeding, alice } = await loadFixture(readyToBreedFixture);

      await breeding.pause();
      await expect(
        breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") })
      ).to.be.revertedWithCustomError(breeding, "EnforcedPause");

      await breeding.unpause();
      await breeding.connect(alice).breed(1, 2, { value: ethers.parseEther("25") });
    });
  });
});
