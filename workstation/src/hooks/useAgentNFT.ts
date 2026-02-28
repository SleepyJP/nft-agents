import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { AgentNFTAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/chains";
import { ELEMENT_NAMES, STAGE_NAMES } from "@/lib/constants";

const NFT_ADDRESS = CONTRACTS.AgentNFT;

export function useAgentData(tokenId: bigint | undefined) {
  return useReadContract({
    address: NFT_ADDRESS,
    abi: AgentNFTAbi,
    functionName: "getAgent",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useAgentBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: NFT_ADDRESS,
    abi: AgentNFTAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useOwnedAgents(address: `0x${string}` | undefined, count: number) {
  const contracts = Array.from({ length: count }, (_, i) => ({
    address: NFT_ADDRESS,
    abi: AgentNFTAbi,
    functionName: "tokenOfOwnerByIndex" as const,
    args: [address!, BigInt(i)] as const,
  }));

  return useReadContracts({
    contracts: address && count > 0 ? contracts : [],
    query: { enabled: !!address && count > 0 },
  });
}

export function useMultipleAgentData(tokenIds: bigint[]) {
  const contracts = tokenIds.map((id) => ({
    address: NFT_ADDRESS,
    abi: AgentNFTAbi,
    functionName: "getAgent" as const,
    args: [id] as const,
  }));

  return useReadContracts({
    contracts: tokenIds.length > 0 ? contracts : [],
    query: { enabled: tokenIds.length > 0 },
  });
}

export function useTotalSupply() {
  return useReadContract({
    address: NFT_ADDRESS,
    abi: AgentNFTAbi,
    functionName: "totalSupply",
  });
}

export function useHasClaimedStarter(address: `0x${string}` | undefined) {
  return useReadContract({
    address: NFT_ADDRESS,
    abi: AgentNFTAbi,
    functionName: "hasClaimedStarter",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useMintTier(tier: number) {
  return useReadContract({
    address: NFT_ADDRESS,
    abi: AgentNFTAbi,
    functionName: "mintTiers",
    args: [BigInt(tier)],
  });
}

export function useMintAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = (element: number, tier: number, price: bigint) => {
    writeContract({
      address: NFT_ADDRESS,
      abi: AgentNFTAbi,
      functionName: "mint",
      args: [element, BigInt(tier)],
      value: price,
    });
  };

  return { mint, hash, isPending, isConfirming, isSuccess, error };
}

export function useMintStarter() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimStarter = (choice: number) => {
    writeContract({
      address: NFT_ADDRESS,
      abi: AgentNFTAbi,
      functionName: "mintStarter",
      args: [choice],
    });
  };

  return { claimStarter, hash, isPending, isConfirming, isSuccess, error };
}

export function useApproveNFT() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (to: `0x${string}`, tokenId: bigint) => {
    writeContract({
      address: NFT_ADDRESS,
      abi: AgentNFTAbi,
      functionName: "approve",
      args: [to, tokenId],
    });
  };

  const setApprovalForAll = (operator: `0x${string}`, approved: boolean) => {
    writeContract({
      address: NFT_ADDRESS,
      abi: AgentNFTAbi,
      functionName: "setApprovalForAll",
      args: [operator, approved],
    });
  };

  return { approve, setApprovalForAll, hash, isPending, isConfirming, isSuccess };
}

// Helpers
export function parseAgentData(raw: any) {
  if (!raw) return null;
  return {
    element: ELEMENT_NAMES[raw.element] || "FIRE",
    evolutionStage: STAGE_NAMES[raw.evolutionStage] || "EGG",
    level: Number(raw.level),
    xp: Number(raw.xp),
    isShiny: raw.isShiny,
    isMythic: raw.isMythic,
    isGenesis: raw.isGenesis,
    parentA: Number(raw.parentA),
    parentB: Number(raw.parentB),
    breedCount: Number(raw.breedCount),
    mintedAt: Number(raw.mintedAt),
  };
}
