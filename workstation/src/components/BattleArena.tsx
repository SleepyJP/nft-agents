"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { formatEther, parseEther } from "viem";
import { ELEMENT_COLORS, ELEMENT_NAMES, BATTLE_TYPE_NAMES, BATTLE_STATUS_NAMES } from "@/lib/constants";
import { useAgentBalance, useOwnedAgents, useMultipleAgentData, parseAgentData } from "@/hooks/useAgentNFT";
import { useBattleData, useNextBattleId, useLeaderboard, useCreateBattle, useJoinBattle, useCancelBattle } from "@/hooks/useBattle";
import { useReadContracts } from "wagmi";
import { BattleArenaAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/chains";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ElementType } from "@/types/agent";

export default function BattleArena() {
  const [tab, setTab] = useState<"open" | "active" | "history">("open");
  const [selectedAgent, setSelectedAgent] = useState<bigint | undefined>(undefined);
  const [battleType, setBattleType] = useState(0);
  const [entryFeeInput, setEntryFeeInput] = useState("1");
  const [durationInput, setDurationInput] = useState("3600");

  const { address, isConnected } = useAccount();
  const { data: balance } = useAgentBalance(address);
  const agentCount = balance ? Number(balance) : 0;
  const { data: ownedTokensResult } = useOwnedAgents(address, agentCount);

  const tokenIds: bigint[] = (ownedTokensResult || [])
    .filter((r) => r.status === "success" && r.result !== undefined)
    .map((r) => r.result as bigint);

  const { data: agentDataResults } = useMultipleAgentData(tokenIds);

  const agents = (agentDataResults || [])
    .map((r, i) => {
      if (r.status !== "success" || !r.result) return null;
      const parsed = parseAgentData(r.result);
      if (!parsed) return null;
      return { ...parsed, tokenId: tokenIds[i] };
    })
    .filter(Boolean) as (NonNullable<ReturnType<typeof parseAgentData>> & { tokenId: bigint })[];

  const { data: nextBattleIdRaw } = useNextBattleId();
  const nextBattleId = nextBattleIdRaw ? Number(nextBattleIdRaw) : 1;

  // Fetch recent battles
  const battleIds = useMemo(() => {
    const ids: bigint[] = [];
    const max = Math.min(nextBattleId - 1, 20);
    for (let i = 1; i <= max; i++) {
      ids.push(BigInt(i));
    }
    return ids;
  }, [nextBattleId]);

  const battleContracts = battleIds.map((id) => ({
    address: CONTRACTS.BattleArena,
    abi: BattleArenaAbi,
    functionName: "getBattle" as const,
    args: [id] as const,
  }));

  const { data: battlesResult } = useReadContracts({
    contracts: battleContracts.length > 0 ? battleContracts : [],
    query: { enabled: battleContracts.length > 0 },
  });

  const battles = (battlesResult || [])
    .map((r) => {
      if (r.status !== "success" || !r.result) return null;
      const b = r.result as any;
      return {
        battleId: Number(b.battleId),
        battleType: Number(b.battleType),
        entryFee: b.entryFee as bigint,
        challengerTokenId: Number(b.challengerTokenId),
        opponentTokenId: Number(b.opponentTokenId),
        challenger: b.challenger as string,
        opponent: b.opponent as string,
        status: Number(b.status),
        winnerId: Number(b.winnerId),
        startTime: Number(b.startTime),
        endTime: Number(b.endTime),
        duration: Number(b.duration),
      };
    })
    .filter(Boolean) as NonNullable<any>[];

  const filteredBattles = battles.filter((b) =>
    tab === "open" ? b.status === 0 :
    tab === "active" ? b.status === 1 :
    b.status === 2 || b.status === 3
  );

  const { createBattle, isPending: isCreating } = useCreateBattle();
  const { joinBattle, isPending: isJoining } = useJoinBattle();
  const { cancel: cancelBattle, isPending: isCancelling } = useCancelBattle();

  // Leaderboard for selected agent
  const { data: leaderboardData } = useLeaderboard(selectedAgent);

  if (!isConnected) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-6">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white">Battle Arena</h2>
        <p className="text-sm text-white/40">Connect your wallet to enter the arena</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-wide text-white">
          Battle Arena
        </h2>
        <p className="mt-1 text-sm text-white/40">
          Challenge other agents to earn XP and climb the leaderboard
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["open", "active", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-5 py-2 text-sm font-medium transition-all ${
              tab === t
                ? "bg-neon-purple/20 text-neon-purple"
                : "text-white/30 hover:bg-white/5 hover:text-white/50"
            }`}
          >
            {t === "open" ? `Open (${battles.filter(b => b.status === 0).length})` : t === "active" ? `Active (${battles.filter(b => b.status === 1).length})` : "History"}
          </button>
        ))}
      </div>

      {/* Create Battle */}
      {tab === "open" && agents.length > 0 && (
        <div className="glass-card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-white/70">Create Challenge</h3>
              <p className="text-xs text-white/30">Choose your agent, battle type, and entry fee</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/30">Agent</label>
              <select
                value={selectedAgent?.toString() || ""}
                onChange={(e) => setSelectedAgent(e.target.value ? BigInt(e.target.value) : undefined)}
                className="w-full rounded-lg border border-white/10 bg-void-800 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Select agent</option>
                {agents.filter(a => a.evolutionStage !== "EGG").map((a) => (
                  <option key={Number(a.tokenId)} value={a.tokenId.toString()}>
                    #{Number(a.tokenId)} ({a.element} Lv.{a.level})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/30">Type</label>
              <select
                value={battleType}
                onChange={(e) => setBattleType(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-void-800 px-3 py-2 text-sm text-white outline-none"
              >
                {BATTLE_TYPE_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/30">Entry Fee (JASMY)</label>
              <input
                type="number"
                min="1"
                value={entryFeeInput}
                onChange={(e) => setEntryFeeInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-void-800 px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                disabled={!selectedAgent || isCreating}
                onClick={() => {
                  if (selectedAgent) {
                    createBattle(
                      battleType,
                      selectedAgent,
                      BigInt(durationInput),
                      parseEther(entryFeeInput || "1")
                    );
                  }
                }}
                className="w-full rounded-xl bg-gradient-to-r from-neon-purple to-neon-blue px-6 py-2.5 font-display text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-neon-purple/20 disabled:opacity-40"
              >
                {isCreating ? "Creating..." : "Create Battle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Battle List */}
      <div className="space-y-4">
        {filteredBattles.length === 0 && (
          <div className="glass-card flex h-32 items-center justify-center">
            <p className="text-sm text-white/20">
              {tab === "open" ? "No open challenges" : tab === "active" ? "No active battles" : "No battle history"}
            </p>
          </div>
        )}
        {filteredBattles.map((battle) => (
          <div key={battle.battleId} className="glass-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                {/* Challenger */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-purple/20">
                    <span className="font-display text-sm font-bold text-neon-purple">
                      #{battle.challengerTokenId}
                    </span>
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold text-white/70">
                      {battle.challenger.slice(0, 6)}...{battle.challenger.slice(-4)}
                    </p>
                    <p className="text-[10px] text-white/30">Challenger</p>
                  </div>
                </div>

                {/* VS */}
                <span className="font-display text-lg font-bold text-white/10">VS</span>

                {/* Opponent */}
                {battle.opponentTokenId > 0 ? (
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-display text-sm font-bold text-white/70">
                        {battle.opponent.slice(0, 6)}...{battle.opponent.slice(-4)}
                      </p>
                      <p className="text-[10px] text-white/30">Opponent</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-blue/20">
                      <span className="font-display text-sm font-bold text-neon-blue">
                        #{battle.opponentTokenId}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-white/10">
                    <span className="text-white/10">?</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-white/60">
                    {formatEther(battle.entryFee)} JASMY
                  </p>
                  <p className="text-[10px] uppercase text-white/20">
                    {BATTLE_TYPE_NAMES[battle.battleType] || "UNKNOWN"} BATTLE
                  </p>
                </div>

                {battle.status === 0 && address && battle.challenger.toLowerCase() !== address.toLowerCase() && (
                  <button
                    disabled={isJoining || !selectedAgent}
                    onClick={() => {
                      if (selectedAgent) {
                        joinBattle(BigInt(battle.battleId), selectedAgent, battle.entryFee);
                      }
                    }}
                    className="rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white/50 transition-all hover:bg-neon-purple/20 hover:text-neon-purple disabled:opacity-40"
                  >
                    {isJoining ? "Joining..." : "Join"}
                  </button>
                )}
                {battle.status === 0 && address && battle.challenger.toLowerCase() === address.toLowerCase() && (
                  <button
                    disabled={isCancelling}
                    onClick={() => cancelBattle(BigInt(battle.battleId))}
                    className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400/70 transition-all hover:bg-red-500/20"
                  >
                    {isCancelling ? "Cancelling..." : "Cancel"}
                  </button>
                )}
                {battle.status === 2 && battle.winnerId > 0 && (
                  <span className="rounded-xl bg-green-400/10 px-4 py-2 text-sm font-medium text-green-400">
                    Winner: #{battle.winnerId}
                  </span>
                )}
                {battle.status === 1 && (
                  <span className="flex items-center gap-1.5 rounded-xl bg-yellow-400/10 px-4 py-2 text-sm font-medium text-yellow-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                    Live
                  </span>
                )}
                {battle.status === 3 && (
                  <span className="rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white/30">
                    Cancelled
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard for selected agent */}
      {leaderboardData && Number(leaderboardData.tokenId) > 0 && (
        <div className="glass-card p-6">
          <h3 className="mb-4 font-display text-lg font-semibold tracking-wide text-white/80">
            Agent #{Number(leaderboardData.tokenId)} Battle Record
          </h3>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <p className="font-mono text-xl font-bold text-green-400">{Number(leaderboardData.wins)}</p>
              <p className="text-[10px] uppercase text-white/25">Wins</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-xl font-bold text-red-400">{Number(leaderboardData.losses)}</p>
              <p className="text-[10px] uppercase text-white/25">Losses</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-xl font-bold text-yellow-400">{Number(leaderboardData.currentStreak)}</p>
              <p className="text-[10px] uppercase text-white/25">Streak</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-xl font-bold text-neon-purple">{Number(leaderboardData.bestStreak)}</p>
              <p className="text-[10px] uppercase text-white/25">Best Streak</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-xl font-bold text-neon-blue">{Number(leaderboardData.highestLevelBeaten)}</p>
              <p className="text-[10px] uppercase text-white/25">Highest Beaten</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
