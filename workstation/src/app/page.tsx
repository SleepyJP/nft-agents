"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import AgentSlots from "@/components/AgentSlots";
import Pokedex from "@/components/Pokedex";
import BattleArena from "@/components/BattleArena";
import BreedingLab from "@/components/BreedingLab";
import MarketplaceView from "@/components/MarketplaceView";
import StarterSelect from "@/components/StarterSelect";

type View = "dashboard" | "slots" | "pokedex" | "battle" | "breeding" | "marketplace" | "starter";

export default function Home() {
  const [activeView, setActiveView] = useState<View>("dashboard");

  const renderView = () => {
    switch (activeView) {
      case "dashboard": return <Dashboard />;
      case "slots": return <AgentSlots />;
      case "pokedex": return <Pokedex />;
      case "battle": return <BattleArena />;
      case "breeding": return <BreedingLab />;
      case "marketplace": return <MarketplaceView />;
      case "starter": return <StarterSelect />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
