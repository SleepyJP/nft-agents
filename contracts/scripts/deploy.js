const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "JASMY");

  const TREASURY = process.env.TREASURY_ADDRESS;
  if (!TREASURY) { throw new Error("Set TREASURY_ADDRESS in .env"); }
  const ROYALTY_BPS = 500; // 5%
  const BASE_URI = "ipfs://"; // Updated post-deploy

  // 1. Deploy X404 Payment Router FIRST (central revenue hub)
  console.log("\n1. Deploying X404PaymentRouter...");
  const X404 = await hre.ethers.getContractFactory("X404PaymentRouter");
  const x404 = await X404.deploy(TREASURY);
  await x404.waitForDeployment();
  const x404Addr = await x404.getAddress();
  console.log("   X404PaymentRouter:", x404Addr);

  // 2. Deploy Pokedex
  console.log("\n2. Deploying Pokedex...");
  const Pokedex = await hre.ethers.getContractFactory("Pokedex");
  const pokedex = await Pokedex.deploy();
  await pokedex.waitForDeployment();
  console.log("   Pokedex:", await pokedex.getAddress());

  // 3. Deploy AgentNFT (treasury points to x404 router)
  console.log("\n3. Deploying AgentNFT...");
  const AgentNFT = await hre.ethers.getContractFactory("AgentNFT");
  const agentNFT = await AgentNFT.deploy(x404Addr, BASE_URI, ROYALTY_BPS);
  await agentNFT.waitForDeployment();
  const agentNFTAddr = await agentNFT.getAddress();
  console.log("   AgentNFT:", agentNFTAddr);

  // 4. Deploy Evolution
  console.log("\n4. Deploying Evolution...");
  const Evolution = await hre.ethers.getContractFactory("Evolution");
  const evolution = await Evolution.deploy(agentNFTAddr);
  await evolution.waitForDeployment();
  const evolutionAddr = await evolution.getAddress();
  console.log("   Evolution:", evolutionAddr);

  // 5. Deploy BattleArena (treasury = x404 router)
  console.log("\n5. Deploying BattleArena...");
  const BattleArena = await hre.ethers.getContractFactory("BattleArena");
  const battleArena = await BattleArena.deploy(agentNFTAddr, evolutionAddr, x404Addr, deployer.address);
  await battleArena.waitForDeployment();
  const battleAddr = await battleArena.getAddress();
  console.log("   BattleArena:", battleAddr);

  // 6. Deploy BreedingLab (treasury = x404 router)
  console.log("\n6. Deploying BreedingLab...");
  const BreedingLab = await hre.ethers.getContractFactory("BreedingLab");
  const breedingLab = await BreedingLab.deploy(agentNFTAddr, x404Addr);
  await breedingLab.waitForDeployment();
  const breedingAddr = await breedingLab.getAddress();
  console.log("   BreedingLab:", breedingAddr);

  // 7. Deploy Marketplace (treasury = x404 router)
  console.log("\n7. Deploying Marketplace...");
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(agentNFTAddr, x404Addr);
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("   Marketplace:", marketplaceAddr);

  // 8. Deploy StarterPack
  console.log("\n8. Deploying StarterPack...");
  const StarterPack = await hre.ethers.getContractFactory("StarterPack");
  const starterPack = await StarterPack.deploy(agentNFTAddr);
  await starterPack.waitForDeployment();
  const starterPackAddr = await starterPack.getAddress();
  console.log("   StarterPack:", starterPackAddr);

  // 9. Wire up AgentNFT operators
  console.log("\n9. Wiring AgentNFT operators...");
  await agentNFT.setEvolutionContract(evolutionAddr);
  console.log("   Evolution authorized");
  await agentNFT.setBattleContract(battleAddr);
  console.log("   BattleArena authorized");
  await agentNFT.setBreedingContract(breedingAddr);
  console.log("   BreedingLab authorized");
  await agentNFT.setMarketplaceContract(marketplaceAddr);
  console.log("   Marketplace authorized");
  await agentNFT.setAuthorizedOperator(starterPackAddr, true);
  console.log("   StarterPack authorized");

  // 10. Wire up Evolution reporters
  console.log("\n10. Wiring Evolution reporters...");
  await evolution.setAuthorizedReporter(battleAddr, true);
  console.log("   BattleArena as XP reporter");

  // 11. Wire up X404 Payment Router — register all revenue sources
  console.log("\n11. Wiring X404 Payment Router...");
  await x404.addRevenueSource("mint_fees", agentNFTAddr);
  console.log("   Registered: AgentNFT (mint_fees)");
  await x404.addRevenueSource("battle_arena", battleAddr);
  console.log("   Registered: BattleArena");
  await x404.addRevenueSource("breeding_lab", breedingAddr);
  console.log("   Registered: BreedingLab");
  await x404.addRevenueSource("marketplace", marketplaceAddr);
  console.log("   Registered: Marketplace");

  // Authorize all contracts to route payments through x404
  await x404.setAuthorizedCaller(agentNFTAddr, true);
  await x404.setAuthorizedCaller(battleAddr, true);
  await x404.setAuthorizedCaller(breedingAddr, true);
  await x404.setAuthorizedCaller(marketplaceAddr, true);
  await x404.setAuthorizedCaller(evolutionAddr, true);
  console.log("   All contracts authorized as callers");

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║        DEPLOYMENT COMPLETE               ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log("║ Network:         JasmyChain (680)        ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log("║ REVENUE HUB                              ║");
  console.log("║ X404 Router:  ", x404Addr);
  console.log("║ Treasury:     ", TREASURY);
  console.log("╠══════════════════════════════════════════╣");
  console.log("║ CORE CONTRACTS                           ║");
  console.log("║ AgentNFT:     ", agentNFTAddr);
  console.log("║ Pokedex:      ", await pokedex.getAddress());
  console.log("║ Evolution:    ", evolutionAddr);
  console.log("╠══════════════════════════════════════════╣");
  console.log("║ GAME CONTRACTS                           ║");
  console.log("║ BattleArena:  ", battleAddr);
  console.log("║ BreedingLab:  ", breedingAddr);
  console.log("╠══════════════════════════════════════════╣");
  console.log("║ MARKET CONTRACTS                         ║");
  console.log("║ Marketplace:  ", marketplaceAddr);
  console.log("║ StarterPack:  ", starterPackAddr);
  console.log("╚══════════════════════════════════════════╝");

  console.log("\n--- Revenue Flow ---");
  console.log("AgentNFT mint fees ──> X404 Router ──> Treasury");
  console.log("BattleArena cuts   ──> X404 Router ──> Treasury");
  console.log("BreedingLab fees   ──> X404 Router ──> Treasury (50% burned)");
  console.log("Marketplace fees   ──> X404 Router ──> Treasury");
  console.log("Agent-to-Agent     ──> X404 Router ──> Agent Balances");
  console.log("Subscriptions      ──> X404 Router ──> Treasury");

  // Save addresses to JSON
  const addresses = {
    X404PaymentRouter: x404Addr,
    AgentNFT: agentNFTAddr,
    Evolution: evolutionAddr,
    BattleArena: battleAddr,
    BreedingLab: breedingAddr,
    Marketplace: marketplaceAddr,
    Pokedex: await pokedex.getAddress(),
    StarterPack: starterPackAddr,
    Treasury: TREASURY,
  };

  const fs = require("fs");
  const path = require("path");
  const outFile = path.join(__dirname, "..", "deployments", `jasmychain-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to:", outFile);

  // Auto-update frontend
  try {
    const updateFrontend = require("./update-frontend");
    updateFrontend(addresses);
  } catch (e) {
    console.log("Note: Run 'node scripts/update-frontend.js' manually to update frontend");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
