import type { ElementType, EvolutionStage, AgentStats } from "@/types/agent";

export const ELEMENT_COLORS: Record<ElementType, { primary: string; secondary: string; accent: string }> = {
  FIRE:     { primary: "#FF4500", secondary: "#FFD700", accent: "#FF6347" },
  WATER:    { primary: "#00BFFF", secondary: "#008B8B", accent: "#00CED1" },
  ELECTRIC: { primary: "#FFD700", secondary: "#9B59B6", accent: "#F39C12" },
  PSYCHIC:  { primary: "#FF69B4", secondary: "#8B008B", accent: "#4B0082" },
  EARTH:    { primary: "#228B22", secondary: "#8B4513", accent: "#556B2F" },
  DARK:     { primary: "#8B0000", secondary: "#2F0000", accent: "#DC143C" },
  DRAGON:   { primary: "#FFD700", secondary: "#00FA9A", accent: "#DAA520" },
  GHOST:    { primary: "#708090", secondary: "#2F4F4F", accent: "#778899" },
  STEEL:    { primary: "#C0C0C0", secondary: "#808080", accent: "#A9A9A9" },
  NATURE:   { primary: "#32CD32", secondary: "#006400", accent: "#7CFC00" },
};

export const ELEMENT_EFFECTS: Record<ElementType, string> = {
  FIRE: "flame-particles",
  WATER: "wave-ripple",
  ELECTRIC: "lightning-arcs",
  PSYCHIC: "psychic-waves",
  EARTH: "stone-crumble",
  DARK: "shadow-tendrils",
  DRAGON: "scale-shimmer",
  GHOST: "ethereal-mist",
  STEEL: "chrome-reflect",
  NATURE: "leaf-spiral",
};

export const EVOLUTION_THRESHOLDS: Record<EvolutionStage, number> = {
  EGG: 0,
  BABY: 1,
  JUVENILE: 100,
  ADULT: 500,
  ALPHA: 2000,
  APEX: 5000,
};

export const EVOLUTION_STAT_MULTIPLIERS: Record<EvolutionStage, number> = {
  EGG: 0,
  BABY: 1.0,
  JUVENILE: 1.3,
  ADULT: 1.7,
  ALPHA: 2.2,
  APEX: 3.0,
};

export const BASE_STATS: Record<ElementType, AgentStats> = {
  FIRE:     { contextWindowSize: 4096,  maxConcurrentTasks: 2, skillSlots: 2, speed: 90,  accuracy: 60, endurance: 50, creativity: 70 },
  WATER:    { contextWindowSize: 8192,  maxConcurrentTasks: 2, skillSlots: 2, speed: 50,  accuracy: 90, endurance: 80, creativity: 60 },
  ELECTRIC: { contextWindowSize: 4096,  maxConcurrentTasks: 3, skillSlots: 2, speed: 95,  accuracy: 70, endurance: 40, creativity: 50 },
  PSYCHIC:  { contextWindowSize: 16384, maxConcurrentTasks: 2, skillSlots: 3, speed: 60,  accuracy: 85, endurance: 55, creativity: 95 },
  EARTH:    { contextWindowSize: 8192,  maxConcurrentTasks: 3, skillSlots: 2, speed: 40,  accuracy: 75, endurance: 95, creativity: 40 },
  DARK:     { contextWindowSize: 4096,  maxConcurrentTasks: 2, skillSlots: 2, speed: 70,  accuracy: 95, endurance: 60, creativity: 50 },
  DRAGON:   { contextWindowSize: 8192,  maxConcurrentTasks: 4, skillSlots: 3, speed: 80,  accuracy: 80, endurance: 70, creativity: 80 },
  GHOST:    { contextWindowSize: 4096,  maxConcurrentTasks: 2, skillSlots: 2, speed: 85,  accuracy: 65, endurance: 45, creativity: 75 },
  STEEL:    { contextWindowSize: 8192,  maxConcurrentTasks: 2, skillSlots: 3, speed: 55,  accuracy: 90, endurance: 90, creativity: 55 },
  NATURE:   { contextWindowSize: 8192,  maxConcurrentTasks: 2, skillSlots: 2, speed: 65,  accuracy: 70, endurance: 70, creativity: 90 },
};

export const STARTER_AGENTS = [
  {
    name: "Embertrade",
    element: "FIRE" as ElementType,
    description: "A fiery trading agent that monitors price pairs and sends blazing-fast alerts. Your first step into the DeFi arena.",
    skills: ["price-monitor", "trade-alert"],
  },
  {
    name: "Aquascan",
    element: "WATER" as ElementType,
    description: "A deep-diving research agent that surfaces insights from the blockchain depths. Summarizes and reports daily.",
    skills: ["topic-research", "daily-report"],
  },
  {
    name: "Voltbot",
    element: "ELECTRIC" as ElementType,
    description: "A lightning-quick automation agent. Runs Telegram commands and cron jobs with shocking efficiency.",
    skills: ["telegram-command", "cron-scheduler"],
  },
] as const;

export const SHINY_CHANCE = 100;       // 1 in 100
export const MYTHIC_CHANCE = 1000;     // 1 in 1000
export const MAX_BREEDS_PER_PARENT = 3;
export const ROYALTY_BPS = 500;        // 5%
export const PLATFORM_FEE_BPS = 200;   // 2%
export const BATTLE_FEE_BPS = 1000;    // 10% of pot
export const TAX_CEILING_BPS = 3000;   // 30% max

export const ELEMENT_NAMES = ["FIRE", "WATER", "ELECTRIC", "PSYCHIC", "EARTH", "DARK", "DRAGON", "GHOST", "STEEL", "NATURE"] as const;
export const STAGE_NAMES = ["EGG", "BABY", "JUVENILE", "ADULT", "ALPHA", "APEX"] as const;
export const BATTLE_TYPE_NAMES = ["PNL", "SPEED", "ACCURACY", "BUILD", "ENDURANCE"] as const;
export const BATTLE_STATUS_NAMES = ["OPEN", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export const LISTING_TYPE_NAMES = ["FIXED_PRICE", "AUCTION"] as const;
export const LISTING_STATUS_NAMES = ["ACTIVE", "SOLD", "CANCELLED", "EXPIRED"] as const;

export const ELEMENT_EMOJI: Record<ElementType, string> = {
  FIRE: "F",
  WATER: "W",
  ELECTRIC: "E",
  PSYCHIC: "P",
  EARTH: "G",
  DARK: "D",
  DRAGON: "X",
  GHOST: "H",
  STEEL: "S",
  NATURE: "N",
};
