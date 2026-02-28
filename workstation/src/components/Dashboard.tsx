"use client";

import { useAccount } from "wagmi";
import { formatEther } from "viem";
import AgentCard from "./AgentCard";
import { ELEMENT_COLORS, ELEMENT_NAMES, STAGE_NAMES } from "@/lib/constants";
import { useAgentBalance, useOwnedAgents, useMultipleAgentData, useTotalSupply, parseAgentData } from "@/hooks/useAgentNFT";
import { useLeaderboard } from "@/hooks/useBattle";
import { useRevenueStats } from "@/hooks/useX404";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useAgentBalance(address);
  const agentCount = balance ? Number(balance) : 0;
  const { data: ownedTokensResult } = useOwnedAgents(address, agentCount);
  const { data: revenueStats } = useRevenueStats();

  const tokenIds: bigint[] = (ownedTokensResult || [])
    .filter((r) => r.status === "success" && r.result !== undefined)
    .map((r) => r.result as bigint);

  const { data: agentDataResults } = useMultipleAgentData(tokenIds);
  const { data: totalSupply } = useTotalSupply();

  // Aggregate battle records across all owned agents
  const agents = (agentDataResults || [])
    .map((r, i) => {
      if (r.status !== "success" || !r.result) return null;
      const parsed = parseAgentData(r.result);
      if (!parsed) return null;
      return { ...parsed, tokenId: Number(tokenIds[i]) };
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof parseAgentData> & { tokenId: number }>[];

  // Use leaderboard for first agent if available
  const firstTokenId = tokenIds.length > 0 ? tokenIds[0] : undefined;
  const { data: leaderboardData } = useLeaderboard(firstTokenId);

  const totalXP = agents.reduce((sum, a) => sum + a.xp, 0);
  const totalWins = leaderboardData ? Number(leaderboardData.wins) : 0;
  const totalLosses = leaderboardData ? Number(leaderboardData.losses) : 0;
  const totalRevenueFormatted = revenueStats ? formatEther(revenueStats[0]) : "0";

  if (!isConnected) {
    return (
      <div className="space-y-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-neon-purple/5 via-void-800 to-neon-blue/5 p-10 text-center">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-neon-purple/10 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-neon-blue/10 blur-[100px]" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-purple to-neon-blue shadow-lg shadow-neon-purple/20">
              <span className="font-display text-2xl font-bold text-white">NA</span>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-wider text-white sm:text-4xl">
              NFT Agents
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/40">
              Collect, evolve, battle, and breed AI agent NFTs. Plug them into your
              workstation to put them to work.
            </p>
            <div className="mt-6">
              <ConnectButton />
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: "◆", label: "Agent Slots", desc: "Drag-drop your agents into active slots", color: "#a855f7" },
            { icon: "⚔", label: "Battle Arena", desc: "PvP battles with JASMY staking", color: "#ff4500" },
            { icon: "⬡", label: "Breeding Lab", desc: "Fuse agents to create hybrids", color: "#00d4ff" },
            { icon: "◉", label: "Marketplace", desc: "Buy, sell, and auction agents", color: "#00ff88" },
          ].map((f) => (
            <div key={f.label} className="glass-card p-5">
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                style={{ backgroundColor: `${f.color}15`, color: f.color }}
              >
                {f.icon}
              </div>
              <h3 className="font-display text-sm font-bold tracking-wide text-white">{f.label}</h3>
              <p className="mt-1 text-xs text-white/30">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Starter Agents Preview */}
        <div>
          <h3 className="mb-4 font-display text-lg font-semibold tracking-wide text-white/80">
            Choose Your Starter
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: "Embertrade", element: "FIRE", desc: "Trading agent — monitors pairs, sends alerts", color: "#FF4500", accent: "#FFD700" },
              { name: "Aquascan", element: "WATER", desc: "Research agent — summarizes topics, daily reports", color: "#00BFFF", accent: "#008B8B" },
              { name: "Voltbot", element: "ELECTRIC", desc: "Automation agent — Telegram bots, cron jobs", color: "#FFD700", accent: "#9B59B6" },
            ].map((s) => (
              <div
                key={s.name}
                className="glass-card group relative overflow-hidden p-5"
                style={{ borderColor: `${s.color}15` }}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-30"
                  style={{ backgroundColor: s.color }}
                />
                <div
                  className="relative mb-3 flex h-20 items-center justify-center rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${s.color}10, ${s.accent}10)`, border: `1px solid ${s.color}15` }}
                >
                  <span className="font-display text-2xl font-bold opacity-40" style={{ color: s.color }}>
                    {s.element.charAt(0)}
                  </span>
                </div>
                <h4 className="font-display text-sm font-bold" style={{ color: s.color }}>{s.name}</h4>
                <span
                  className="mt-1 inline-block rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${s.color}20`, color: s.color }}
                >
                  {s.element}
                </span>
                <p className="mt-2 text-xs text-white/30">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Preview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-5 text-center">
            <p className="font-display text-2xl font-bold text-neon-purple">
              {totalSupply ? Number(totalSupply).toLocaleString() : "0"}
            </p>
            <p className="mt-1 text-xs text-white/30">Agents Minted</p>
          </div>
          <div className="glass-card p-5 text-center">
            <p className="font-display text-2xl font-bold text-neon-blue">10</p>
            <p className="mt-1 text-xs text-white/30">Element Types</p>
          </div>
          <div className="glass-card p-5 text-center">
            <p className="font-display text-2xl font-bold text-neon-green">6</p>
            <p className="mt-1 text-xs text-white/30">Evolution Stages</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-white">
            Command Center
          </h2>
          <p className="mt-1 text-sm text-white/40">
            Your AI agent fleet at a glance
          </p>
        </div>
        <ConnectButton />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-white/30">
            Active Agents
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-neon-green">
            {agentCount}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-white/30">
            Total XP Earned
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-neon-blue">
            {totalXP.toLocaleString()}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-white/30">
            Battle Record
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-neon-purple">
            {totalWins}W / {totalLosses}L
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-widest text-white/30">
            Platform Revenue
          </p>
          <p className="mt-2 font-display text-2xl font-bold" style={{ color: "#ffd700" }}>
            {Number(totalRevenueFormatted).toFixed(2)} JASMY
          </p>
        </div>
      </div>

      {/* Supply Info */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-white/30">Total Supply</p>
            <p className="mt-1 font-display text-lg font-bold text-white/70">
              {totalSupply ? Number(totalSupply).toLocaleString() : "0"} / 10,000
            </p>
          </div>
          <div className="h-2 w-48 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-purple to-neon-blue"
              style={{ width: `${totalSupply ? (Number(totalSupply) / 10000) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Active Agents */}
      <div>
        <h3 className="mb-4 font-display text-lg font-semibold tracking-wide text-white/80">
          Active Fleet
        </h3>
        {agents.length > 0 ? (
          <div className="grid grid-cols-3 gap-6">
            {agents.map((agent) => {
              const colors = ELEMENT_COLORS[agent.element as keyof typeof ELEMENT_COLORS];
              return (
                <div key={agent.tokenId} className={`glass-card group relative overflow-hidden p-6 ${agent.isShiny ? "holographic" : ""}`} style={{ borderColor: `${colors?.primary || "#fff"}22` }}>
                  {/* Element glow */}
                  <div
                    className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
                    style={{ backgroundColor: colors?.primary }}
                  />
                  {/* Header */}
                  <div className="relative flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold tracking-wide" style={{ color: colors?.primary }}>
                        Agent #{agent.tokenId}
                      </h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: `${colors?.primary}20`, color: colors?.primary }}
                        >
                          {agent.element}
                        </span>
                        {agent.isShiny && (
                          <span className="rounded-md bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">SHINY</span>
                        )}
                        {agent.isMythic && (
                          <span className="rounded-md bg-pink-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-400">MYTHIC</span>
                        )}
                        {agent.isGenesis && (
                          <span className="rounded-md bg-purple-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-400">GENESIS</span>
                        )}
                      </div>
                    </div>
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-bold"
                      style={{ backgroundColor: `${colors?.primary}15`, color: colors?.primary, border: `1px solid ${colors?.primary}30` }}
                    >
                      {agent.level}
                    </div>
                  </div>

                  {/* Avatar placeholder */}
                  <div
                    className="relative my-4 flex h-28 items-center justify-center rounded-xl"
                    style={{ background: `linear-gradient(135deg, ${colors?.primary}10, ${colors?.secondary}10)`, border: `1px solid ${colors?.primary}15` }}
                  >
                    <span className="font-display text-3xl font-bold opacity-30" style={{ color: colors?.primary }}>
                      {agent.element.charAt(0)}
                    </span>
                    <span
                      className="absolute bottom-2 right-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{ backgroundColor: `${colors?.primary}20`, color: colors?.primary }}
                    >
                      {agent.evolutionStage}
                    </span>
                  </div>

                  {/* XP Bar */}
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">XP</span>
                      <span className="font-mono text-[10px] text-white/40">{agent.xp.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((agent.xp / 5000) * 100, 100)}%`,
                          background: `linear-gradient(90deg, ${colors?.primary}, ${colors?.accent})`,
                          boxShadow: `0 0 8px ${colors?.primary}60`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-[10px] text-white/25">BREEDS</span>
                    <span className="font-mono text-xs text-white/40">{agent.breedCount}/3</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card flex h-48 flex-col items-center justify-center">
            <p className="font-display text-sm text-white/30">No agents found</p>
            <p className="mt-1 text-xs text-white/20">Claim a starter or mint from the marketplace</p>
          </div>
        )}
      </div>
    </div>
  );
}
