"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { STARTER_AGENTS, ELEMENT_COLORS } from "@/lib/constants";
import { useHasClaimedStarter } from "@/hooks/useAgentNFT";
import { useCanClaimStarter, useStarterCounts, useTotalStartersClaimed, useClaimStarter } from "@/hooks/useStarterPack";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function StarterSelect() {
  const [selected, setSelected] = useState<number | null>(null);
  const { address, isConnected } = useAccount();

  const { data: hasClaimed } = useHasClaimedStarter(address);
  const { data: canClaim } = useCanClaimStarter(address);
  const { data: starterCounts } = useStarterCounts();
  const { data: totalClaimed } = useTotalStartersClaimed();
  const { claim, isPending, isConfirming, isSuccess, error } = useClaimStarter();

  const alreadyClaimed = hasClaimed === true;
  const canClaimBool = canClaim === true;

  if (!isConnected) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-6">
        <h2 className="font-display text-3xl font-bold tracking-wide text-white">Choose Your Starter Agent</h2>
        <p className="text-sm text-white/40">Connect your wallet to claim your free starter agent</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold tracking-wide text-white">
          Choose Your Starter Agent
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-white/40">
          Every trainer starts with one. Pick your first AI agent and begin your journey.
          Free mint -- you only pay gas.
        </p>
        {totalClaimed !== undefined && (
          <p className="mt-2 font-mono text-xs text-white/20">
            {Number(totalClaimed).toLocaleString()} / 5,000 starters claimed
          </p>
        )}
      </div>

      <div className="mx-auto grid max-w-4xl grid-cols-3 gap-8">
        {STARTER_AGENTS.map((starter, index) => {
          const colors = ELEMENT_COLORS[starter.element];
          const isSelected = selected === index;
          const count = starterCounts ? Number((starterCounts as any)[index]) : 0;

          return (
            <button
              key={starter.name}
              onClick={() => setSelected(index)}
              disabled={alreadyClaimed}
              className={`glass-card relative overflow-hidden p-8 text-center transition-all duration-300 ${
                isSelected
                  ? "scale-105 shadow-2xl"
                  : "hover:scale-[1.02]"
              }`}
              style={{
                borderColor: isSelected ? `${colors.primary}50` : `${colors.primary}15`,
                boxShadow: isSelected ? `0 0 40px ${colors.primary}20` : undefined,
              }}
            >
              {/* Background glow */}
              <div
                className={`pointer-events-none absolute inset-0 rounded-[20px] transition-opacity ${
                  isSelected ? "opacity-20" : "opacity-0"
                }`}
                style={{
                  background: `radial-gradient(circle at center, ${colors.primary}, transparent 70%)`,
                }}
              />

              {/* Selected indicator */}
              {isSelected && (
                <div
                  className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.primary }}
                >
                  <span className="text-xs font-bold text-black">OK</span>
                </div>
              )}

              {/* Avatar */}
              <div
                className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-3xl"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}20)`,
                  border: `2px solid ${colors.primary}${isSelected ? "40" : "15"}`,
                }}
              >
                <span className="font-display text-4xl font-bold" style={{ color: colors.primary }}>
                  {starter.element.charAt(0)}
                </span>
              </div>

              {/* Name */}
              <h3
                className="font-display text-xl font-bold tracking-wide"
                style={{ color: colors.primary }}
              >
                {starter.name}
              </h3>

              {/* Type badge */}
              <div className="mt-2 flex justify-center">
                <span
                  className="rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${colors.primary}20`,
                    color: colors.primary,
                  }}
                >
                  {starter.element}
                </span>
              </div>

              {/* Description */}
              <p className="mt-4 text-xs leading-relaxed text-white/40">
                {starter.description}
              </p>

              {/* Skills */}
              <div className="mt-4 flex justify-center gap-2">
                {starter.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-md bg-white/5 px-2 py-1 text-[9px] font-medium text-white/30"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {/* Claimed count */}
              <p className="mt-3 font-mono text-[10px] text-white/15">
                {count} claimed
              </p>
            </button>
          );
        })}
      </div>

      {/* Claim Button */}
      <div className="flex justify-center">
        {alreadyClaimed ? (
          <div className="text-center">
            <h3 className="font-display text-xl font-bold text-neon-green">
              Starter Already Claimed
            </h3>
            <p className="mt-2 text-sm text-white/40">
              You already have a starter agent. Head to Agent Slots to view it.
            </p>
          </div>
        ) : isSuccess ? (
          <div className="text-center">
            <h3 className="font-display text-xl font-bold text-neon-green">
              {selected !== null ? STARTER_AGENTS[selected].name : "Starter"} Claimed!
            </h3>
            <p className="mt-2 text-sm text-white/40">
              Your starter agent is hatching. Head to Agent Slots to activate it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <button
              disabled={selected === null || !canClaimBool || isPending || isConfirming}
              onClick={() => {
                if (selected !== null) {
                  claim(selected);
                }
              }}
              className={`rounded-2xl px-12 py-4 font-display text-lg font-bold text-white transition-all ${
                selected !== null && canClaimBool
                  ? "bg-gradient-to-r from-neon-purple to-neon-blue shadow-lg shadow-neon-purple/20 hover:shadow-xl hover:shadow-neon-purple/30"
                  : "cursor-not-allowed bg-white/5 text-white/20"
              }`}
            >
              {isPending ? "Confirming in wallet..." :
               isConfirming ? "Minting..." :
               selected !== null ? `Claim ${STARTER_AGENTS[selected].name}` :
               "Select a Starter"}
            </button>
            {error && (
              <p className="text-xs text-red-400">
                {error.message?.includes("Already claimed") ? "You already claimed a starter" : "Transaction failed. Try again."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
