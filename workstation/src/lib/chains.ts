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
      http: ["https://rpc.jasmyscan.net"],
      webSocket: ["wss://rpc.jasmyscan.net/ws"],
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
  AgentNFT: "0x125C881abe899c074788Cf2Ada0C8d9E80A4eA1b",
  Evolution: "0x6Ef91FeA0eC05479F227E9D1B242947A482ef933",
  BattleArena: "0xCBeD0aD4bFf282B550A60749a25aFB0D0Cc79a6e",
  BreedingLab: "0x3E6990a8B516335A4866D70E221BfDB1447D2Ae0",
  Marketplace: "0xbea587FbbAc47EC4bf3E2779F3ca4c04F1De6E9F",
  Pokedex: "0x8Eb18940C5FDe7f0bF7a37Ba10eA146964ABceB2",
  StarterPack: "0x06E7279d9467844967cd310dDac827A69877BcF5",
  X404PaymentRouter: "0x0b77e3A3498C7c1F6b2c374bc9940C4fF4De0A6b",
} as const;

// Treasury and canister IDs set via env or post-deploy config
export const TREASURY = (process.env.NEXT_PUBLIC_TREASURY || "") as `0x${string}`;

export const ICP_CANISTERS = {
  bridge: process.env.NEXT_PUBLIC_ICP_BRIDGE || "",
  agentNFT: process.env.NEXT_PUBLIC_ICP_AGENT_NFT || "",
  pokedex: process.env.NEXT_PUBLIC_ICP_POKEDEX || "",
  marketplace: process.env.NEXT_PUBLIC_ICP_MARKETPLACE || "",
  cyclesManager: process.env.NEXT_PUBLIC_ICP_CYCLES || "",
} as const;
