const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("AgentNFT", function () {
  async function deployFixture() {
    const [owner, treasury, alice, bob, carol] = await ethers.getSigners();

    const AgentNFT = await ethers.getContractFactory("AgentNFT");
    const agentNFT = await AgentNFT.deploy(
      treasury.address,
      "https://api.nftagents.io/metadata/",
      500 // 5% royalty
    );

    return { agentNFT, owner, treasury, alice, bob, carol };
  }

  describe("Deployment", function () {
    it("should set correct ERC-721 metadata", async function () {
      const { agentNFT } = await loadFixture(deployFixture);
      expect(await agentNFT.name()).to.equal("NFT Agents");
      expect(await agentNFT.symbol()).to.equal("AGENT");
    });

    it("should set treasury address", async function () {
      const { agentNFT, treasury } = await loadFixture(deployFixture);
      expect(await agentNFT.treasury()).to.equal(treasury.address);
    });

    it("should set default royalty", async function () {
      const { agentNFT, treasury } = await loadFixture(deployFixture);
      const [receiver, amount] = await agentNFT.royaltyInfo(1, ethers.parseEther("100"));
      expect(receiver).to.equal(treasury.address);
      expect(amount).to.equal(ethers.parseEther("5")); // 5%
    });

    it("should initialize mint tiers", async function () {
      const { agentNFT } = await loadFixture(deployFixture);

      const common = await agentNFT.mintTiers(0);
      expect(common.price).to.equal(ethers.parseEther("10"));
      expect(common.maxSupply).to.equal(7000);
      expect(common.active).to.be.true;

      const rare = await agentNFT.mintTiers(1);
      expect(rare.price).to.equal(ethers.parseEther("50"));
      expect(rare.maxSupply).to.equal(2500);

      const legendary = await agentNFT.mintTiers(2);
      expect(legendary.price).to.equal(ethers.parseEther("500"));
      expect(legendary.maxSupply).to.equal(500);
    });

    it("should revert with zero treasury", async function () {
      const AgentNFT = await ethers.getContractFactory("AgentNFT");
      await expect(
        AgentNFT.deploy(ethers.ZeroAddress, "https://test/", 500)
      ).to.be.revertedWith("Invalid treasury");
    });

    it("should revert if royalty exceeds tax ceiling", async function () {
      const [, treasury] = await ethers.getSigners();
      const AgentNFT = await ethers.getContractFactory("AgentNFT");
      await expect(
        AgentNFT.deploy(treasury.address, "https://test/", 3001)
      ).to.be.revertedWith("Exceeds tax ceiling");
    });
  });

  describe("Minting", function () {
    it("should mint a COMMON tier agent", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });

      expect(await agentNFT.ownerOf(1)).to.equal(alice.address);

      const agent = await agentNFT.getAgent(1);
      expect(agent.element).to.equal(0); // FIRE
      expect(agent.evolutionStage).to.equal(0); // EGG
      expect(agent.level).to.equal(0);
      expect(agent.xp).to.equal(0);
    });

    it("should mint a RARE tier agent", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(3, 1, { value: ethers.parseEther("50") });

      expect(await agentNFT.ownerOf(1)).to.equal(alice.address);
      const agent = await agentNFT.getAgent(1);
      expect(agent.element).to.equal(3); // PSYCHIC
    });

    it("should mint a LEGENDARY tier agent", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(6, 2, { value: ethers.parseEther("500") });
      expect(await agentNFT.ownerOf(1)).to.equal(alice.address);
    });

    it("should revert with invalid element", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);
      await expect(
        agentNFT.connect(alice).mint(10, 0, { value: ethers.parseEther("10") })
      ).to.be.revertedWith("Invalid element");
    });

    it("should revert with invalid tier", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);
      await expect(
        agentNFT.connect(alice).mint(0, 3, { value: ethers.parseEther("10") })
      ).to.be.revertedWith("Invalid tier");
    });

    it("should revert with insufficient payment", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);
      await expect(
        agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("9") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("should send mint price to treasury", async function () {
      const { agentNFT, treasury, alice } = await loadFixture(deployFixture);

      const balBefore = await ethers.provider.getBalance(treasury.address);
      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });
      const balAfter = await ethers.provider.getBalance(treasury.address);

      expect(balAfter - balBefore).to.equal(ethers.parseEther("10"));
    });

    it("should refund excess payment", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      const balBefore = await ethers.provider.getBalance(alice.address);
      const tx = await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("15") });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(alice.address);

      // Should have spent exactly 10 ETH + gas
      expect(balBefore - balAfter - gasUsed).to.equal(ethers.parseEther("10"));
    });

    it("should mark first 1000 tokens as genesis", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });
      const agent = await agentNFT.getAgent(1);
      expect(agent.isGenesis).to.be.true;
    });

    it("should increment minted count per tier", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") });
      const tier = await agentNFT.mintTiers(0);
      expect(tier.minted).to.equal(1);
    });

    it("should emit AgentMinted event", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await expect(
        agentNFT.connect(alice).mint(0, 0, { value: ethers.parseEther("10") })
      ).to.emit(agentNFT, "AgentMinted");
    });
  });

  describe("Starter Minting", function () {
    it("should mint a starter agent for free", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0); // FIRE
      expect(await agentNFT.ownerOf(1)).to.equal(alice.address);

      const agent = await agentNFT.getAgent(1);
      expect(agent.element).to.equal(0); // FIRE
      expect(agent.evolutionStage).to.equal(1); // BABY (already hatched)
      expect(agent.level).to.equal(1);
    });

    it("should mint different starter elements", async function () {
      const { agentNFT, alice, bob, carol } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.connect(bob).mintStarter(1);
      await agentNFT.connect(carol).mintStarter(2);

      expect((await agentNFT.getAgent(1)).element).to.equal(0); // FIRE
      expect((await agentNFT.getAgent(2)).element).to.equal(1); // WATER
      expect((await agentNFT.getAgent(3)).element).to.equal(2); // ELECTRIC
    });

    it("should prevent claiming starter twice", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await expect(
        agentNFT.connect(alice).mintStarter(1)
      ).to.be.revertedWith("Already claimed");
    });

    it("should revert with invalid starter choice", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);
      await expect(
        agentNFT.connect(alice).mintStarter(3)
      ).to.be.revertedWith("Invalid starter");
    });

    it("should emit StarterClaimed event", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await expect(agentNFT.connect(alice).mintStarter(0))
        .to.emit(agentNFT, "StarterClaimed")
        .withArgs(alice.address, 1, 0);
    });
  });

  describe("Agent Data (Authorized Operators)", function () {
    it("should allow owner to set authorized operator", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.setAuthorizedOperator(alice.address, true);
      expect(await agentNFT.authorizedOperators(alice.address)).to.be.true;
    });

    it("should allow authorized operator to add XP", async function () {
      const { agentNFT, owner, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.setAuthorizedOperator(owner.address, true);
      await agentNFT.addAgentXP(1, 100, "test");

      expect(await agentNFT.getAgentXP(1)).to.equal(100);
    });

    it("should reject unauthorized XP modification", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await expect(
        agentNFT.connect(alice).addAgentXP(1, 100, "test")
      ).to.be.revertedWith("Not authorized");
    });

    it("should allow authorized operator to set evolution stage", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      // Owner is authorized by default
      await agentNFT.setEvolutionStage(1, 2);
      expect(await agentNFT.getEvolutionStage(1)).to.equal(2);
    });

    it("should prevent de-evolution", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.setEvolutionStage(1, 3);

      await expect(
        agentNFT.setEvolutionStage(1, 2)
      ).to.be.revertedWith("Cannot de-evolve");
    });

    it("should prevent invalid evolution stage", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await expect(
        agentNFT.setEvolutionStage(1, 6)
      ).to.be.revertedWith("Invalid stage");
    });
  });

  describe("Read Functions", function () {
    it("should return correct agent data", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mint(5, 0, { value: ethers.parseEther("10") });
      const agent = await agentNFT.getAgent(1);
      expect(agent.element).to.equal(5);
      expect(agent.evolutionStage).to.equal(0);
    });

    it("should return next token ID", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      expect(await agentNFT.nextTokenId()).to.equal(1);
      await agentNFT.connect(alice).mintStarter(0);
      expect(await agentNFT.nextTokenId()).to.equal(2);
    });

    it("should revert getAgent for nonexistent token", async function () {
      const { agentNFT } = await loadFixture(deployFixture);
      await expect(agentNFT.getAgent(999)).to.be.revertedWith("Token does not exist");
    });
  });

  describe("Owner Setters (Paisley Rule)", function () {
    it("should update treasury", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.setTreasury(alice.address);
      expect(await agentNFT.treasury()).to.equal(alice.address);
    });

    it("should reject zero address treasury", async function () {
      const { agentNFT } = await loadFixture(deployFixture);
      await expect(
        agentNFT.setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury");
    });

    it("should set evolution contract and authorize", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.setEvolutionContract(alice.address);
      expect(await agentNFT.evolutionContract()).to.equal(alice.address);
      expect(await agentNFT.authorizedOperators(alice.address)).to.be.true;
    });

    it("should set battle contract and authorize", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.setBattleContract(alice.address);
      expect(await agentNFT.battleContract()).to.equal(alice.address);
      expect(await agentNFT.authorizedOperators(alice.address)).to.be.true;
    });

    it("should set breeding contract and authorize", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.setBreedingContract(alice.address);
      expect(await agentNFT.breedingContract()).to.equal(alice.address);
      expect(await agentNFT.authorizedOperators(alice.address)).to.be.true;
    });

    it("should set shiny chance", async function () {
      const { agentNFT } = await loadFixture(deployFixture);

      await agentNFT.setShinyChance(50);
      expect(await agentNFT.shinyChance()).to.equal(50);
    });

    it("should reject shiny chance too generous", async function () {
      const { agentNFT } = await loadFixture(deployFixture);
      await expect(agentNFT.setShinyChance(9)).to.be.revertedWith("Too generous");
    });

    it("should set mythic chance", async function () {
      const { agentNFT } = await loadFixture(deployFixture);

      await agentNFT.setMythicChance(500);
      expect(await agentNFT.mythicChance()).to.equal(500);
    });

    it("should reject mythic chance too generous", async function () {
      const { agentNFT } = await loadFixture(deployFixture);
      await expect(agentNFT.setMythicChance(99)).to.be.revertedWith("Too generous");
    });

    it("should update mint tier", async function () {
      const { agentNFT } = await loadFixture(deployFixture);

      await agentNFT.setMintTier(0, ethers.parseEther("20"), 8000, true);
      const tier = await agentNFT.mintTiers(0);
      expect(tier.price).to.equal(ethers.parseEther("20"));
      expect(tier.maxSupply).to.equal(8000);
    });

    it("should update default royalty", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.setDefaultRoyalty(alice.address, 1000);
      const [receiver, amount] = await agentNFT.royaltyInfo(1, ethers.parseEther("100"));
      expect(receiver).to.equal(alice.address);
      expect(amount).to.equal(ethers.parseEther("10")); // 10%
    });

    it("should reject royalty exceeding ceiling", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);
      await expect(
        agentNFT.setDefaultRoyalty(alice.address, 3001)
      ).to.be.revertedWith("Exceeds tax ceiling");
    });

    it("should reject non-owner calls", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);
      await expect(
        agentNFT.connect(alice).setTreasury(alice.address)
      ).to.be.revertedWithCustomError(agentNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("Pause / Emergency", function () {
    it("should pause and unpause", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      await agentNFT.pause();

      await expect(
        agentNFT.connect(alice).mintStarter(0)
      ).to.be.revertedWithCustomError(agentNFT, "EnforcedPause");

      await agentNFT.unpause();
      await agentNFT.connect(alice).mintStarter(0);
      expect(await agentNFT.ownerOf(1)).to.equal(alice.address);
    });

    it("should rescue ETH", async function () {
      const { agentNFT, alice } = await loadFixture(deployFixture);

      // Send ETH to contract
      await alice.sendTransaction({ to: await agentNFT.getAddress(), value: ethers.parseEther("1") });

      const balBefore = await ethers.provider.getBalance(alice.address);
      await agentNFT.rescueETH(alice.address);
      const balAfter = await ethers.provider.getBalance(alice.address);

      expect(balAfter - balBefore).to.equal(ethers.parseEther("1"));
    });
  });

  describe("ERC-721 Enumerable", function () {
    it("should track total supply", async function () {
      const { agentNFT, alice, bob } = await loadFixture(deployFixture);

      await agentNFT.connect(alice).mintStarter(0);
      await agentNFT.connect(bob).mintStarter(1);

      expect(await agentNFT.totalSupply()).to.equal(2);
    });

    it("should support ERC-165 interfaces", async function () {
      const { agentNFT } = await loadFixture(deployFixture);

      // ERC-165
      expect(await agentNFT.supportsInterface("0x01ffc9a7")).to.be.true;
      // ERC-721
      expect(await agentNFT.supportsInterface("0x80ac58cd")).to.be.true;
      // ERC-2981
      expect(await agentNFT.supportsInterface("0x2a55205a")).to.be.true;
    });
  });
});
