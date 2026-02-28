import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { StarterPackAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/chains";

const STARTER_ADDRESS = CONTRACTS.StarterPack;

export function useCanClaimStarter(address: `0x${string}` | undefined) {
  return useReadContract({
    address: STARTER_ADDRESS,
    abi: StarterPackAbi,
    functionName: "canClaim",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useStarterCounts() {
  return useReadContract({
    address: STARTER_ADDRESS,
    abi: StarterPackAbi,
    functionName: "getStarterCounts",
  });
}

export function useTotalStartersClaimed() {
  return useReadContract({
    address: STARTER_ADDRESS,
    abi: StarterPackAbi,
    functionName: "totalClaimed",
  });
}

export function useClaimStarter() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = (starterChoice: number) => {
    writeContract({
      address: STARTER_ADDRESS,
      abi: StarterPackAbi,
      functionName: "claimStarter",
      args: [starterChoice],
    });
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error };
}
