/**
 * Export compiled ABIs to workstation/src/lib/abis.generated.ts
 * Run: npx hardhat run scripts/export-abis.js
 */
const fs = require("fs");
const path = require("path");

const contracts = [
  "AgentNFT",
  "Evolution",
  "BattleArena",
  "BreedingLab",
  "Marketplace",
  "Pokedex",
  "StarterPack",
  "X404PaymentRouter",
];

async function main() {
  let output = "// Auto-generated from compiled artifacts — do not edit manually\n";
  output += "// Run: cd contracts && npx hardhat run scripts/export-abis.js\n\n";

  for (const name of contracts) {
    const artifactPath = path.join(
      __dirname,
      "..",
      "artifacts",
      "src",
      `${name}.sol`,
      `${name}.json`
    );

    if (!fs.existsSync(artifactPath)) {
      console.error(`Artifact not found: ${artifactPath}`);
      continue;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    output += `export const ${name}Abi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n\n`;
    console.log(`Exported: ${name} (${artifact.abi.length} ABI entries)`);
  }

  const outPath = path.join(
    __dirname,
    "..",
    "..",
    "workstation",
    "src",
    "lib",
    "abis.generated.ts"
  );
  fs.writeFileSync(outPath, output);
  console.log(`\nWritten to: ${outPath}`);
}

main().catch(console.error);
