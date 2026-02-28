"use client";

import { useAccount } from "wagmi";
import { ELEMENT_COLORS, ELEMENT_NAMES, STAGE_NAMES } from "@/lib/constants";
import { useAgentBalance, useOwnedAgents, useMultipleAgentData, parseAgentData } from "@/hooks/useAgentNFT";
import { useHatch, useCanEvolve, useEvolve } from "@/hooks/useEvolution";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ElementType } from "@/types/agent";

const MAX_SLOTS = 6;

export default function AgentSlots() {
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

  const { hatch, isPending: isHatching } = useHatch();
  const { evolve, isPending: isEvolving } = useEvolve();

  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => {
    const agent = agents[i] || null;
    return { id: i + 1, agent };
  });

  if (!isConnected) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-6">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white">Agent Slots</h2>
        <p className="text-sm text-white/40">Connect your wallet to manage agent slots</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-wide text-white">
          Agent Slots
        </h2>
        <p className="mt-1 text-sm text-white/40">
          Your on-chain Agent NFTs plugged into the workstation
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {slots.map((slot) => {
          const agent = slot.agent;
          const colors = agent ? ELEMENT_COLORS[agent.element as ElementType] : null;

          return (
            <div
              key={slot.id}
              className={`glass-card relative flex h-64 flex-col items-center justify-center transition-all duration-300 ${
                agent ? "border-opacity-100" : "border-dashed border-white/10"
              }`}
              style={colors ? { borderColor: `${colors.primary}30` } : undefined}
            >
              {agent && colors ? (
                <>
                  {/* Active slot glow */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[20px] opacity-10"
                    style={{ background: `radial-gradient(circle at center, ${colors.primary}, transparent 70%)` }}
                  />

                  {/* Slot number */}
                  <div className="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-md bg-white/5 font-mono text-[10px] text-white/30">
                    {slot.id}
                  </div>

                  {/* Status indicator */}
                  <div className="absolute right-4 top-4 flex items-center gap-1.5">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                    <span className="text-[10px] font-medium text-green-400/70">ACTIVE</span>
                  </div>

                  {/* Agent icon */}
                  <div
                    className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl"
                    style={{
                      background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}20)`,
                      border: `1px solid ${colors.primary}25`,
                    }}
                  >
                    <span className="font-display text-2xl font-bold" style={{ color: colors.primary }}>
                      {agent.element.charAt(0)}
                    </span>
                  </div>

                  {/* Agent name */}
                  <h3
                    className="font-display text-sm font-bold tracking-wide"
                    style={{ color: colors.primary }}
                  >
                    Agent #{Number(agent.tokenId)}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-white/30">
                    Lv.{agent.level} | {agent.element} | {agent.evolutionStage}
                  </p>

                  {/* Actions */}
                  {agent.evolutionStage === "EGG" && (
                    <button
                      onClick={() => hatch(agent.tokenId)}
                      disabled={isHatching}
                      className="mt-3 rounded-lg bg-neon-green/20 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neon-green transition-all hover:bg-neon-green/30"
                    >
                      {isHatching ? "Hatching..." : "Hatch"}
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Empty slot */}
                  <div className="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-md bg-white/5 font-mono text-[10px] text-white/20">
                    {slot.id}
                  </div>
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-white/10">
                    <span className="text-2xl text-white/10">+</span>
                  </div>
                  <p className="mt-3 text-xs text-white/20">Empty Slot</p>
                  <p className="mt-1 text-[10px] text-white/10">
                    Mint or purchase an agent NFT
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Context Bench */}
      <div className="glass-card p-6">
        <h3 className="mb-4 font-display text-lg font-semibold tracking-wide text-white/80">
          Context Bench
        </h3>
        <p className="text-sm text-white/30">
          Drag documents, URLs, code snippets, and API keys here. Your active agents will have access to everything on the bench.
        </p>
        <div className="mt-4 flex h-32 items-center justify-center rounded-xl border border-dashed border-white/10">
          <p className="text-sm text-white/15">Drop context items here</p>
        </div>
      </div>
    </div>
  );
}
