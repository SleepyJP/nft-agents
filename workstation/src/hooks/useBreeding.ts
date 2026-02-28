import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BreedingLabAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/chains";

const BREEDING_ADDRESS = CONTRACTS.BreedingLab;

export function useCanBreed(parentA: bigint | undefined, parentB: bigint | undefined) {
  return useReadContract({
    address: BREEDING_ADDRESS,
    abi: BreedingLabAbi,
    functionName: "canBreed",
    args: parentA !== undefined && parentB !== undefined ? [parentA, parentB] : undefined,
    query: { enabled: parentA !== undefined && parentB !== undefined },
  });
}

export function usePreviewHybrid(elementA: number | undefined, elementB: number | undefined) {
  return useReadContract({
    address: BREEDING_ADDRESS,
    abi: BreedingLabAbi,
    functionName: "previewHybridElement",
    args: elementA !== undefined && elementB !== undefined ? [elementA, elementB] : undefined,
    query: { enabled: elementA !== undefined && elementB !== undefined },
  });
}

export function useBreedingFee() {
  return useReadContract({
    address: BREEDING_ADDRESS,
    abi: BreedingLabAbi,
    functionName: "breedingFee",
  });
}

export function useBreedCooldown(tokenId: bigint | undefined) {
  return useReadContract({
    address: BREEDING_ADDRESS,
    abi: BreedingLabAbi,
    functionName: "lastBreedTime" as any,
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useBreed() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const breed = (parentA: bigint, parentB: bigint, fee: bigint) => {
    writeContract({
      address: BREEDING_ADDRESS,
      abi: BreedingLabAbi,
      functionName: "breed",
      args: [parentA, parentB],
      value: fee,
    });
  };

  return { breed, hash, isPending, isConfirming, isSuccess, error };
}
