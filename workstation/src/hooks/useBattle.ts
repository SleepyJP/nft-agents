import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BattleArenaAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/chains";

const BATTLE_ADDRESS = CONTRACTS.BattleArena;

export function useBattleData(battleId: bigint | undefined) {
  return useReadContract({
    address: BATTLE_ADDRESS,
    abi: BattleArenaAbi,
    functionName: "getBattle",
    args: battleId !== undefined ? [battleId] : undefined,
    query: { enabled: battleId !== undefined },
  });
}

export function useLeaderboard(tokenId: bigint | undefined) {
  return useReadContract({
    address: BATTLE_ADDRESS,
    abi: BattleArenaAbi,
    functionName: "getLeaderboard",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useNextBattleId() {
  return useReadContract({
    address: BATTLE_ADDRESS,
    abi: BattleArenaAbi,
    functionName: "nextBattleId",
  });
}

export function useCreateBattle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createBattle = (battleType: number, tokenId: bigint, duration: bigint, entryFee: bigint) => {
    writeContract({
      address: BATTLE_ADDRESS,
      abi: BattleArenaAbi,
      functionName: "createBattle",
      args: [battleType, tokenId, duration],
      value: entryFee,
    });
  };

  return { createBattle, hash, isPending, isConfirming, isSuccess, error };
}

export function useJoinBattle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const joinBattle = (battleId: bigint, tokenId: bigint, entryFee: bigint) => {
    writeContract({
      address: BATTLE_ADDRESS,
      abi: BattleArenaAbi,
      functionName: "joinBattle",
      args: [battleId, tokenId],
      value: entryFee,
    });
  };

  return { joinBattle, hash, isPending, isConfirming, isSuccess, error };
}

export function useCancelBattle() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancel = (battleId: bigint) => {
    writeContract({
      address: BATTLE_ADDRESS,
      abi: BattleArenaAbi,
      functionName: "cancelBattle",
      args: [battleId],
    });
  };

  return { cancel, hash, isPending, isConfirming, isSuccess };
}
