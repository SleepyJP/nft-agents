import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { jasmychain } from "./chains";

export const config = getDefaultConfig({
  appName: "NFT Agents Workstation",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "nft-agents-dev",
  chains: [jasmychain],
  transports: {
    [jasmychain.id]: http("https://rpc.jasmyscan.net"),
  },
  ssr: true,
});
