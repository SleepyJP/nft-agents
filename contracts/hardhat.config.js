require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const rawKey = process.env.DEPLOYER_PRIVATE_KEY || "";
const DEPLOYER_KEY = rawKey.startsWith("0x") && rawKey.length === 66 ? rawKey : "0x" + "0".repeat(64);

module.exports = {
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    jasmychain: {
      url: "https://rpc.jasmyscan.net",
      chainId: 680,
      accounts: [DEPLOYER_KEY],
      gasPrice: "auto",
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: {
      jasmychain: process.env.JASMYSCAN_API_KEY || "none",
    },
    customChains: [
      {
        network: "jasmychain",
        chainId: 680,
        urls: {
          apiURL: "https://explorer.jasmyscan.net/api",
          browserURL: "https://explorer.jasmyscan.net",
        },
      },
    ],
  },
};
