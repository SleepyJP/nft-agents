import { defineChain } from "viem";

export const jasmychain = defineChain({
  id: 680,
  name: "JasmyChain",
  nativeCurrency: {
    decimals: 18,
    name: "JASMY",
    symbol: "JASMY",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.jasmychain.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "JasmyScan",
      url: "https://explorer.jasmyscan.net",
    },
  },
});

export const CONTRACTS = {
  X404PaymentRouter: "0x0b77e3A3498C7c1F6b2c374bc9940C4fF4De0A6b" as `0x${string}`,
  AgentNFT: "0x125C881abe899c074788Cf2Ada0C8d9E80A4eA1b" as `0x${string}`,
  Evolution: "0x6Ef91FeA0eC05479F227E9D1B242947A482ef933" as `0x${string}`,
  BattleArena: "0xCBeD0aD4bFf282B550A60749a25aFB0D0Cc79a6e" as `0x${string}`,
  BreedingLab: "0x3E6990a8B516335A4866D70E221BfDB1447D2Ae0" as `0x${string}`,
  Marketplace: "0xbea587FbbAc47EC4bf3E2779F3ca4c04F1De6E9F" as `0x${string}`,
  Pokedex: "0x8Eb18940C5FDe7f0bF7a37Ba10eA146964ABceB2" as `0x${string}`,
  StarterPack: "0x06E7279d9467844967cd310dDac827A69877BcF5" as `0x${string}`,
} as const;

export const TREASURY = "0x49bBEFa1d94702C0e9a5EAdDEc7c3C5D3eb9086B" as `0x${string}`;

export const ICP_CANISTERS = {
  bridge: process.env.NEXT_PUBLIC_ICP_BRIDGE || "j4fnr-yyaaa-aaaad-qhy4q-cai",
  agentNFT: process.env.NEXT_PUBLIC_ICP_AGENT_NFT || "",
  pokedex: process.env.NEXT_PUBLIC_ICP_POKEDEX || "",
  marketplace: process.env.NEXT_PUBLIC_ICP_MARKETPLACE || "",
  cyclesManager: process.env.NEXT_PUBLIC_ICP_CYCLES || "",
} as const;
