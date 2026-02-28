"use client";

import { ELEMENT_COLORS } from "@/lib/constants";
import type { AgentMetadata, ElementType } from "@/types/agent";

interface AgentCardProps {
  agent: AgentMetadata;
  onClick?: () => void;
  compact?: boolean;
}

const stageLabels = ["EGG", "BABY", "JUV", "ADULT", "ALPHA", "APEX"];

export default function AgentCard({ agent, onClick, compact }: AgentCardProps) {
  const colors = ELEMENT_COLORS[agent.element];
  const xpPercent = agent.xpToNextLevel > 0
    ? Math.min((agent.xp / agent.xpToNextLevel) * 100, 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className={`glass-card group relative cursor-pointer overflow-hidden ${
        compact ? "p-4" : "p-6"
      } ${agent.isShiny ? "holographic" : ""}`}
      style={{
        borderColor: `${colors.primary}22`,
      }}
    >
      {/* Element glow accent */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
        style={{ backgroundColor: colors.primary }}
      />

      {/* Header: Name + Type Badge */}
      <div className="relative flex items-start justify-between">
        <div>
          <h3
            className="font-display text-lg font-bold tracking-wide"
            style={{ color: colors.primary }}
          >
            {agent.name}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${colors.primary}20`,
                color: colors.primary,
              }}
            >
              {agent.element}
            </span>
            {agent.isShiny && (
              <span className="rounded-md bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                SHINY
              </span>
            )}
            {agent.rarity === "GENESIS" && (
              <span className="rounded-md bg-purple-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                GENESIS
              </span>
            )}
          </div>
        </div>

        {/* Level Badge */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-bold"
          style={{
            backgroundColor: `${colors.primary}15`,
            color: colors.primary,
            border: `1px solid ${colors.primary}30`,
          }}
        >
          {agent.level}
        </div>
      </div>

      {/* Avatar placeholder */}
      <div
        className="relative my-4 flex h-32 items-center justify-center rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${colors.primary}10, ${colors.secondary}10)`,
          border: `1px solid ${colors.primary}15`,
        }}
      >
        <span className="font-display text-4xl opacity-30" style={{ color: colors.primary }}>
          {agent.element === "FIRE" ? "🔥" : agent.element === "WATER" ? "🌊" : agent.element === "ELECTRIC" ? "⚡" : agent.element === "PSYCHIC" ? "🔮" : agent.element === "EARTH" ? "🪨" : agent.element === "DARK" ? "🌑" : agent.element === "DRAGON" ? "🐉" : agent.element === "GHOST" ? "👻" : agent.element === "STEEL" ? "⚙️" : "🌿"}
        </span>
        <span
          className="absolute bottom-2 right-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{
            backgroundColor: `${colors.primary}20`,
            color: colors.primary,
          }}
        >
          {stageLabels[["EGG", "BABY", "JUVENILE", "ADULT", "ALPHA", "APEX"].indexOf(agent.evolutionStage)] || agent.evolutionStage}
        </span>
      </div>

      {/* XP Bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">XP</span>
          <span className="font-mono text-[10px] text-white/40">
            {agent.xp?.toLocaleString()} / {agent.xpToNextLevel?.toLocaleString()}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${xpPercent}%`,
              background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
              boxShadow: `0 0 8px ${colors.primary}60`,
            }}
          />
        </div>
      </div>

      {/* Stats mini-bar */}
      {!compact && agent.stats && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "SPD", value: agent.stats.speed },
            { label: "ACC", value: agent.stats.accuracy },
            { label: "END", value: agent.stats.endurance },
            { label: "CRE", value: agent.stats.creativity },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-[9px] font-medium uppercase tracking-wider text-white/25">
                {stat.label}
              </p>
              <p className="font-mono text-xs font-bold text-white/60">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Battle record */}
      {!compact && agent.battleRecord && (
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
          <span className="text-[10px] text-white/25">BATTLES</span>
          <div className="flex gap-3">
            <span className="font-mono text-xs text-green-400">
              {agent.battleRecord.wins}W
            </span>
            <span className="font-mono text-xs text-red-400">
              {agent.battleRecord.losses}L
            </span>
            <span className="font-mono text-xs text-yellow-400">
              {agent.battleRecord.currentStreak} streak
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
