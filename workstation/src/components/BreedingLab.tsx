"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { ELEMENT_COLORS, ELEMENT_NAMES } from "@/lib/constants";
import { useAgentBalance, useOwnedAgents, useMultipleAgentData, parseAgentData } from "@/hooks/useAgentNFT";
import { useCanBreed, useBreedingFee, usePreviewHybrid, useBreed } from "@/hooks/useBreeding";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ElementType } from "@/types/agent";

export default function BreedingLab() {
  const [parentAId, setParentAId] = useState<bigint | undefined>(undefined);
  const [parentBId, setParentBId] = useState<bigint | undefined>(undefined);

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

  const parentA = parentAId ? agents.find(a => a.tokenId === parentAId) : null;
  const parentB = parentBId ? agents.find(a => a.tokenId === parentBId) : null;

  const { data: canBreedResult } = useCanBreed(parentAId, parentBId);
  const canBreedBool = canBreedResult ? (canBreedResult as any)[0] as boolean : false;
  const canBreedReason = canBreedResult ? (canBreedResult as any)[1] as string : "";

  const { data: breedingFee } = useBreedingFee();

  const parentAElementIdx = parentA ? ELEMENT_NAMES.indexOf(parentA.element as any) : undefined;
  const parentBElementIdx = parentB ? ELEMENT_NAMES.indexOf(parentB.element as any) : undefined;
  const { data: hybridElement } = usePreviewHybrid(parentAElementIdx, parentBElementIdx);

  const hybridElementName = hybridElement !== undefined ? ELEMENT_NAMES[Number(hybridElement)] : null;
  const hybridColors = hybridElementName ? ELEMENT_COLORS[hybridElementName as ElementType] : null;

  const { breed, isPending: isBreeding, isConfirming, isSuccess } = useBreed();

  if (!isConnected) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-6">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white">Breeding Lab</h2>
        <p className="text-sm text-white/40">Connect your wallet to access the breeding lab</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-wide text-white">
          Breeding Lab
        </h2>
        <p className="mt-1 text-sm text-white/40">
          Fuse two agents to create a powerful hybrid. Both must be ADULT (stage 3+) or higher.
        </p>
      </div>

      {/* Breeding Station */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-center gap-8">
          {/* Parent A */}
          <div className="w-48">
            {parentA ? (
              <div
                className="glass-card cursor-pointer p-5 text-center"
                onClick={() => setParentAId(undefined)}
                style={{ borderColor: `${ELEMENT_COLORS[parentA.element as ElementType].primary}30` }}
              >
                <span className="font-display text-3xl font-bold" style={{ color: ELEMENT_COLORS[parentA.element as ElementType].primary }}>
                  {parentA.element.charAt(0)}
                </span>
                <p
                  className="mt-2 font-display text-sm font-bold"
                  style={{ color: ELEMENT_COLORS[parentA.element as ElementType].primary }}
                >
                  Agent #{Number(parentA.tokenId)}
                </p>
                <p className="mt-1 text-[10px] text-white/30">
                  Lv.{parentA.level} | {parentA.element} | Breeds: {parentA.breedCount}/3
                </p>
              </div>
            ) : (
              <div className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed border-white/10 transition-colors hover:border-white/20">
                <span className="text-2xl text-white/10">+</span>
                <p className="mt-2 text-xs text-white/20">Select Parent A</p>
              </div>
            )}
          </div>

          {/* Fusion indicator */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-neon-purple/20 to-neon-blue/20">
              <span className="font-display text-xl font-bold text-white/20">+</span>
            </div>
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white/20">
              FUSE
            </span>
          </div>

          {/* Parent B */}
          <div className="w-48">
            {parentB ? (
              <div
                className="glass-card cursor-pointer p-5 text-center"
                onClick={() => setParentBId(undefined)}
                style={{ borderColor: `${ELEMENT_COLORS[parentB.element as ElementType].primary}30` }}
              >
                <span className="font-display text-3xl font-bold" style={{ color: ELEMENT_COLORS[parentB.element as ElementType].primary }}>
                  {parentB.element.charAt(0)}
                </span>
                <p
                  className="mt-2 font-display text-sm font-bold"
                  style={{ color: ELEMENT_COLORS[parentB.element as ElementType].primary }}
                >
                  Agent #{Number(parentB.tokenId)}
                </p>
                <p className="mt-1 text-[10px] text-white/30">
                  Lv.{parentB.level} | {parentB.element} | Breeds: {parentB.breedCount}/3
                </p>
              </div>
            ) : (
              <div className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed border-white/10 transition-colors hover:border-white/20">
                <span className="text-2xl text-white/10">+</span>
                <p className="mt-2 text-xs text-white/20">Select Parent B</p>
              </div>
            )}
          </div>
        </div>

        {/* Hybrid Preview */}
        {parentA && parentB && hybridElementName && hybridColors && (
          <div className="mt-8 border-t border-white/5 pt-8">
            <h4 className="mb-4 text-center font-display text-xs font-bold uppercase tracking-widest text-white/30">
              Predicted Hybrid
            </h4>

            {/* Breed eligibility */}
            {canBreedResult && !canBreedBool && (
              <div className="mx-auto mb-4 w-64 rounded-lg bg-red-500/10 px-4 py-2 text-center text-xs text-red-400">
                {canBreedReason || "Cannot breed these agents"}
              </div>
            )}

            <div
              className="mx-auto w-64 rounded-2xl p-6 text-center"
              style={{
                background: `linear-gradient(135deg, ${hybridColors.primary}10, ${hybridColors.secondary}10)`,
                border: `1px solid ${hybridColors.primary}25`,
              }}
            >
              <span className="font-display text-4xl font-bold" style={{ color: hybridColors.primary }}>
                {hybridElementName.charAt(0)}
              </span>
              <p className="mt-3 font-display text-lg font-bold" style={{ color: hybridColors.primary }}>
                {hybridElementName} Hybrid
              </p>
              <p className="mt-1 text-xs text-white/30">
                {hybridElementName} type | Starts as EGG
              </p>
              <p className="mt-2 font-mono text-xs text-white/20">
                Fee: {breedingFee ? formatEther(breedingFee) : "25"} JASMY (50% burned)
              </p>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                disabled={!canBreedBool || isBreeding || isConfirming}
                onClick={() => {
                  if (parentAId && parentBId && breedingFee) {
                    breed(parentAId, parentBId, breedingFee);
                  }
                }}
                className="rounded-xl bg-gradient-to-r from-neon-purple to-neon-blue px-8 py-3 font-display text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-neon-purple/20 disabled:opacity-40"
              >
                {isBreeding ? "Breeding..." : isConfirming ? "Confirming..." : isSuccess ? "Bred!" : "Breed Agents"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Agent Selection */}
      <div>
        <h3 className="mb-4 font-display text-lg font-semibold tracking-wide text-white/80">
          Your Agents
        </h3>
        {agents.length > 0 ? (
          <div className="grid grid-cols-4 gap-4">
            {agents.map((agent) => {
              const colors = ELEMENT_COLORS[agent.element as ElementType];
              const isSelectedA = parentAId === agent.tokenId;
              const isSelectedB = parentBId === agent.tokenId;
              const isSelected = isSelectedA || isSelectedB;

              return (
                <button
                  key={Number(agent.tokenId)}
                  disabled={isSelected}
                  onClick={() => {
                    if (!parentAId) setParentAId(agent.tokenId);
                    else if (!parentBId && agent.tokenId !== parentAId) setParentBId(agent.tokenId);
                  }}
                  className={`glass-card p-4 text-left transition-all ${
                    isSelected ? "opacity-40" : "hover:border-white/20"
                  }`}
                  style={!isSelected ? { borderColor: `${colors.primary}15` } : undefined}
                >
                  <p className="font-display text-sm font-bold" style={{ color: colors.primary }}>
                    Agent #{Number(agent.tokenId)}
                  </p>
                  <p className="mt-1 text-[10px] text-white/30">
                    Lv.{agent.level} | {agent.element} | {agent.evolutionStage} | {agent.breedCount}/3 breeds
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="glass-card flex h-32 items-center justify-center">
            <p className="text-sm text-white/20">No agents found. Mint or claim a starter first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
