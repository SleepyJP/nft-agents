"use client";

import { useState } from "react";

interface SidebarProps {
  activeView: string;
  onNavigate: (view: any) => void;
}

const navItems = [
  { id: "dashboard", label: "Command Center", icon: "⌘" },
  { id: "slots", label: "Agent Slots", icon: "◆" },
  { id: "pokedex", label: "Pokédex", icon: "◈" },
  { id: "battle", label: "Battle Arena", icon: "⚔" },
  { id: "breeding", label: "Breeding Lab", icon: "⬡" },
  { id: "marketplace", label: "Marketplace", icon: "◉" },
  { id: "starter", label: "Starter Pack", icon: "★" },
];

export default function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col border-r border-white/5 bg-void-800 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neon-purple to-neon-blue">
          <span className="font-display text-sm font-bold text-white">NA</span>
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-display text-sm font-bold tracking-wider text-white">
              NFT AGENTS
            </h1>
            <p className="text-[10px] tracking-widest text-white/30">
              JASMY • ICP
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
              activeView === item.id
                ? "bg-white/10 text-white shadow-lg shadow-neon-purple/5"
                : "text-white/40 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs transition-all ${
                activeView === item.id
                  ? "bg-neon-purple/20 text-neon-purple"
                  : "bg-white/5 text-white/30 group-hover:bg-white/10 group-hover:text-white/50"
              }`}
            >
              {item.icon}
            </span>
            {!collapsed && <span className="font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-white/5 px-2 py-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg py-2 text-white/20 transition-colors hover:bg-white/5 hover:text-white/40"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>
    </aside>
  );
}
