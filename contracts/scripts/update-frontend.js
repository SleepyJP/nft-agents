/**
 * After deployment, run this with contract addresses to update the frontend config.
 * Usage: node scripts/update-frontend.js <addresses-json>
 *
 * Or call from deploy script:
 *   const addresses = { AgentNFT: "0x...", ... };
 *   require("./update-frontend")(addresses);
 */
const fs = require("fs");
const path = require("path");

function updateFrontend(addresses) {
  const chainsPath = path.join(__dirname, "..", "..", "workstation", "src", "lib", "chains.ts");

  if (!fs.existsSync(chainsPath)) {
    console.error("chains.ts not found at:", chainsPath);
    return;
  }

  let content = fs.readFileSync(chainsPath, "utf8");

  // Replace CONTRACTS block
  const contractsBlock = `export const CONTRACTS = {
  AgentNFT: "${addresses.AgentNFT}",
  Evolution: "${addresses.Evolution}",
  BattleArena: "${addresses.BattleArena}",
  BreedingLab: "${addresses.BreedingLab}",
  Marketplace: "${addresses.Marketplace}",
  Pokedex: "${addresses.Pokedex}",
  StarterPack: "${addresses.StarterPack}",
  X404PaymentRouter: "${addresses.X404PaymentRouter}",
} as const;`;

  // Find and replace the CONTRACTS export
  const contractsRegex = /export const CONTRACTS = \{[\s\S]*?\} as const;/;
  if (contractsRegex.test(content)) {
    content = content.replace(contractsRegex, contractsBlock);
  } else {
    content += "\n\n" + contractsBlock + "\n";
  }

  fs.writeFileSync(chainsPath, content);
  console.log("Updated workstation/src/lib/chains.ts with deployed addresses");
}

// If run directly from CLI
if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.log("Usage: node scripts/update-frontend.js '{\"AgentNFT\":\"0x...\", ...}'");
    process.exit(1);
  }
  updateFrontend(JSON.parse(arg));
}

module.exports = updateFrontend;
