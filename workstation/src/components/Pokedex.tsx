"use client";

import { useState } from "react";
import { ELEMENT_COLORS, EVOLUTION_THRESHOLDS, ELEMENT_NAMES } from "@/lib/constants";
import { useAllPokedexTypes, usePokedexTypeCount } from "@/hooks/usePokedex";
import type { ElementType } from "@/types/agent";

export default function Pokedex() {
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [filter, setFilter] = useState("");

  const { data: allTypesRaw, isLoading } = useAllPokedexTypes();
  const { data: typeCount } = usePokedexTypeCount();

  // Parse on-chain types into display format
  const allTypes = (allTypesRaw || []).map((t: any) => ({
    typeId: Number(t.typeId),
    typeName: t.typeName as string,
    element: ELEMENT_NAMES[Number(t.element)] || "FIRE",
    description: t.description as string,
    baseStats: {
      contextWindowSize: Number(t.baseStats.contextWindowSize),
      maxConcurrentTasks: Number(t.baseStats.maxConcurrentTasks),
      skillSlots: Number(t.baseStats.skillSlots),
      speed: Number(t.baseStats.speed),
      accuracy: Number(t.baseStats.accuracy),
      endurance: Number(t.baseStats.endurance),
      creativity: Number(t.baseStats.creativity),
    },
    totalMinted: Number(t.totalMinted),
    totalActive: Number(t.totalActive),
    totalBurned: Number(t.totalBurned),
    exists: t.exists as boolean,
  }));

  const filtered = allTypes.filter(
    (t) =>
      t.exists &&
      (t.typeName.toLowerCase().includes(filter.toLowerCase()) ||
        t.description.toLowerCase().includes(filter.toLowerCase()) ||
        t.element.toLowerCase().includes(filter.toLowerCase()))
  );

  const selected = selectedTypeId !== null ? allTypes.find((t) => t.typeId === selectedTypeId) : null;
  const selectedElement = selected ? selected.element as ElementType : null;
  const colors = selectedElement ? ELEMENT_COLORS[selectedElement] : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-white">Pokedex</h2>
          <p className="mt-1 text-sm text-white/40">
            {typeCount !== undefined ? `${Number(typeCount)} registered agent types` : "Loading types..."}
          </p>
        </div>
        <input
          type="text"
          placeholder="Search types..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-void-800 px-4 py-2 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-neon-purple/50"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="glass-card shimmer h-32 p-4" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {filtered.map((type) => {
            const c = ELEMENT_COLORS[type.element as ElementType];
            const isSelected = selectedTypeId === type.typeId;

            return (
              <button
                key={type.typeId}
                onClick={() => setSelectedTypeId(isSelected ? null : type.typeId)}
                className={`glass-card p-4 text-left transition-all ${
                  isSelected ? "ring-1" : ""
                }`}
                style={isSelected ? { outlineColor: c.primary, borderColor: `${c.primary}40` } as React.CSSProperties : undefined}
              >
                <div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${c.primary}15` }}
                >
                  <span className="font-display text-lg font-bold" style={{ color: c.primary }}>
                    {type.element.charAt(0)}
                  </span>
                </div>
                <h4 className="font-display text-sm font-bold" style={{ color: c.primary }}>
                  {type.typeName}
                </h4>
                <p className="mt-0.5 text-[10px] text-white/30">{type.description}</p>
                <div className="mt-2 flex gap-3">
                  <span className="font-mono text-[10px] text-white/20">{type.totalMinted} minted</span>
                  <span className="font-mono text-[10px] text-green-400/40">{type.totalActive} active</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Panel */}
      {selected && colors && (
        <div className="glass-card p-8" style={{ borderColor: `${colors.primary}20` }}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-display text-xl font-bold" style={{ color: colors.primary }}>
                {selected.typeName}
              </h3>
              <p className="mt-1 text-sm text-white/40">{selected.description}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-bold text-white/60">{selected.totalMinted}</p>
              <p className="text-[10px] text-white/25">TOTAL MINTED</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-4">
            {Object.entries(selected.baseStats).map(([key, value]) => (
              <div key={key} className="text-center">
                <div className="mb-2 h-24 overflow-hidden rounded-lg bg-white/5">
                  <div
                    className="w-full rounded-lg transition-all duration-500"
                    style={{
                      height: `${Math.min(Number(value), 100)}%`,
                      marginTop: `${100 - Math.min(Number(value), 100)}%`,
                      background: `linear-gradient(to top, ${colors.primary}, ${colors.primary}40)`,
                    }}
                  />
                </div>
                <p className="font-mono text-xs font-bold text-white/50">{value}</p>
                <p className="text-[8px] uppercase tracking-wider text-white/20">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </p>
              </div>
            ))}
          </div>

          {/* Evolution Path */}
          <div className="mt-6 border-t border-white/5 pt-6">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-widest text-white/30">
              Evolution Path
            </h4>
            <div className="flex items-center gap-2">
              {(["EGG", "BABY", "JUVENILE", "ADULT", "ALPHA", "APEX"] as const).map((stage, i) => (
                <div key={stage} className="flex items-center gap-2">
                  <div
                    className="rounded-lg px-3 py-1.5 text-center"
                    style={{ backgroundColor: `${colors.primary}${10 + i * 8}` }}
                  >
                    <p className="font-display text-[10px] font-bold" style={{ color: colors.primary }}>
                      {stage}
                    </p>
                    <p className="font-mono text-[8px] text-white/30">
                      {EVOLUTION_THRESHOLDS[stage]} XP
                    </p>
                  </div>
                  {i < 5 && <span className="text-white/15">{"->"}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
