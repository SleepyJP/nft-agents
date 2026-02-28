// ---------------------------------------------------------------
// NFT AGENTS — Core Type Definitions
// Pokémon-style AI Agent NFTs
// ---------------------------------------------------------------

export type ElementType =
  | "FIRE"
  | "WATER"
  | "ELECTRIC"
  | "PSYCHIC"
  | "EARTH"
  | "DARK"
  | "DRAGON"
  | "GHOST"
  | "STEEL"
  | "NATURE";

export type EvolutionStage =
  | "EGG"
  | "BABY"
  | "JUVENILE"
  | "ADULT"
  | "ALPHA"
  | "APEX";

export type BattleType =
  | "PNL"
  | "SPEED"
  | "ACCURACY"
  | "BUILD"
  | "ENDURANCE";

export type RarityTier = "COMMON" | "RARE" | "LEGENDARY" | "SHINY" | "MYTHIC" | "GENESIS";

export interface AgentStats {
  contextWindowSize: number;
  maxConcurrentTasks: number;
  skillSlots: number;
  speed: number;
  accuracy: number;
  endurance: number;
  creativity: number;
}

export interface AgentSkin {
  skinId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundEffect: string;
  fontFamily: string;
  borderStyle: string;
  avatarAnimation: string;
  sounds: {
    notification: string;
    evolution: string;
    battleStart: string;
    victory: string;
  };
  /** SECURITY: Must be IPFS/Pinata URL only. Never load arbitrary external CSS. Validated by sanitizeSkinUri(). */
  cssOverrides?: string;
  particleConfig?: ParticleConfig;
}

export interface ParticleConfig {
  type: string;
  count: number;
  speed: number;
  color: string[];
  size: [number, number];
  opacity: [number, number];
}

export interface AgentMetadata {
  tokenId: number;
  name: string;
  description: string;
  image: string;
  element: ElementType;
  evolutionStage: EvolutionStage;
  level: number;
  xp: number;
  xpToNextLevel: number;
  rarity: RarityTier;
  isShiny: boolean;
  stats: AgentStats;
  skills: AgentSkill[];
  skinUri: string;
  skin?: AgentSkin;
  personality: AgentPersonality;
  battleRecord: BattleRecord;
  lineage: AgentLineage;
  chain: "jasmychain" | "icp";
  contractAddress: string;
  canisterId?: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  level: number;
  cooldown?: number;
  apiEndpoint?: string;
}

export interface AgentPersonality {
  systemPrompt: string;
  tone: string;
  traits: string[];
  specialization: string;
}

export interface BattleRecord {
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  highestLevelBeaten: number;
  totalBattles: number;
}

export interface AgentLineage {
  parentA?: number;
  parentB?: number;
  children: number[];
  generation: number;
  breedCount: number;
  maxBreeds: number;
}

export interface PokedexEntry {
  typeId: number;
  typeName: string;
  element: ElementType;
  description: string;
  baseStats: AgentStats;
  evolutionPath: EvolutionStage[];
  totalMinted: number;
  totalActive: number;
  rarityDistribution: Record<RarityTier, number>;
}

export interface Battle {
  id: number;
  battleType: BattleType;
  entryFee: bigint;
  challenger: AgentMetadata;
  opponent?: AgentMetadata;
  status: "open" | "active" | "completed" | "cancelled";
  winner?: number;
  duration: number;
  startTime: number;
  endTime?: number;
}

export interface WorkstationSlot {
  slotId: number;
  agent?: AgentMetadata;
  isActive: boolean;
  contextBench: ContextItem[];
}

export interface ContextItem {
  id: string;
  type: "document" | "url" | "code" | "apikey" | "data";
  name: string;
  content: string;
  addedAt: number;
}

export interface MarketplaceListing {
  listingId: number;
  tokenId: number;
  agent: AgentMetadata;
  seller: string;
  price: bigint;
  listingType: "fixed" | "auction";
  highestBid?: bigint;
  highestBidder?: string;
  expiresAt?: number;
  createdAt: number;
}
