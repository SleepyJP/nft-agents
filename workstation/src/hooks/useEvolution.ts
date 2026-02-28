import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { EvolutionAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/chains";

const EVOLUTION_ADDRESS = CONTRACTS.Evolution;

export function useCanEvolve(tokenId: bigint | undefined) {
  return useReadContract({
    address: EVOLUTION_ADDRESS,
    abi: EvolutionAbi,
    functionName: "canEvolve",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useEvolutionThreshold(stage: number) {
  return useReadContract({
    address: EVOLUTION_ADDRESS,
    abi: EvolutionAbi,
    functionName: "evolutionXPThresholds",
    args: [BigInt(stage)],
  });
}

export function useHatch() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const hatch = (tokenId: bigint) => {
    writeContract({
      address: EVOLUTION_ADDRESS,
      abi: EvolutionAbi,
      functionName: "hatch",
      args: [tokenId],
    });
  };

  return { hatch, hash, isPending, isConfirming, isSuccess, error };
}

export function useEvolve() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const evolve = (tokenId: bigint) => {
    writeContract({
      address: EVOLUTION_ADDRESS,
      abi: EvolutionAbi,
      functionName: "evolve",
      args: [tokenId],
    });
  };

  return { evolve, hash, isPending, isConfirming, isSuccess, error };
}
