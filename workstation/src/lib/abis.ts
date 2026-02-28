// Contract ABIs — extracted from Solidity interfaces
// Only the functions needed by the frontend

export const AgentNFTAbi = [
  // Read
  { type: "function", name: "getAgent", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "element", type: "uint8" }, { name: "evolutionStage", type: "uint8" }, { name: "level", type: "uint16" }, { name: "xp", type: "uint64" }, { name: "isShiny", type: "bool" }, { name: "isMythic", type: "bool" }, { name: "isGenesis", type: "bool" }, { name: "parentA", type: "uint16" }, { name: "parentB", type: "uint16" }, { name: "breedCount", type: "uint8" }, { name: "mintedAt", type: "uint64" }] }], stateMutability: "view" },
  { type: "function", name: "ownerOf", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "tokenOfOwnerByIndex", inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "tokenURI", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
  { type: "function", name: "nextTokenId", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalSupply", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "hasClaimedStarter", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "mintTiers", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "price", type: "uint256" }, { name: "maxSupply", type: "uint16" }, { name: "minted", type: "uint16" }, { name: "active", type: "bool" }], stateMutability: "view" },
  // Write
  { type: "function", name: "mint", inputs: [{ name: "element", type: "uint8" }, { name: "tier", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "mintStarter", inputs: [{ name: "starterChoice", type: "uint8" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "approve", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setApprovalForAll", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
  // Events
  { type: "event", name: "AgentMinted", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "element", type: "uint8" }, { name: "isShiny", type: "bool" }, { name: "isMythic", type: "bool" }, { name: "isGenesis", type: "bool" }] },
  { type: "event", name: "AgentEvolved", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "newStage", type: "uint8" }, { name: "newLevel", type: "uint16" }] },
  { type: "event", name: "StarterClaimed", inputs: [{ name: "user", type: "address", indexed: true }, { name: "tokenId", type: "uint256" }, { name: "starterChoice", type: "uint8" }] },
] as const;

export const EvolutionAbi = [
  { type: "function", name: "hatch", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "evolve", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "canEvolve", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "bool" }, { name: "nextStage", type: "uint8" }, { name: "xpNeeded", type: "uint64" }], stateMutability: "view" },
  { type: "function", name: "evolutionXPThresholds", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "uint64" }], stateMutability: "view" },
] as const;

export const BattleArenaAbi = [
  { type: "function", name: "createBattle", inputs: [{ name: "battleType", type: "uint8" }, { name: "challengerTokenId", type: "uint256" }, { name: "duration", type: "uint64" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "joinBattle", inputs: [{ name: "battleId", type: "uint256" }, { name: "opponentTokenId", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "cancelBattle", inputs: [{ name: "battleId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getBattle", inputs: [{ name: "battleId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "battleId", type: "uint256" }, { name: "battleType", type: "uint8" }, { name: "entryFee", type: "uint256" }, { name: "challengerTokenId", type: "uint256" }, { name: "opponentTokenId", type: "uint256" }, { name: "challenger", type: "address" }, { name: "opponent", type: "address" }, { name: "status", type: "uint8" }, { name: "winnerId", type: "uint256" }, { name: "startTime", type: "uint64" }, { name: "endTime", type: "uint64" }, { name: "duration", type: "uint64" }] }], stateMutability: "view" },
  { type: "function", name: "getLeaderboard", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "tokenId", type: "uint256" }, { name: "wins", type: "uint32" }, { name: "losses", type: "uint32" }, { name: "currentStreak", type: "uint32" }, { name: "bestStreak", type: "uint32" }, { name: "highestLevelBeaten", type: "uint16" }] }], stateMutability: "view" },
  { type: "function", name: "nextBattleId", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "event", name: "BattleCreated", inputs: [{ name: "battleId", type: "uint256", indexed: true }, { name: "battleType", type: "uint8" }, { name: "entryFee", type: "uint256" }, { name: "challengerTokenId", type: "uint256" }, { name: "challenger", type: "address" }] },
  { type: "event", name: "BattleCompleted", inputs: [{ name: "battleId", type: "uint256", indexed: true }, { name: "winnerId", type: "uint256" }, { name: "loserId", type: "uint256" }] },
] as const;

export const BreedingLabAbi = [
  { type: "function", name: "breed", inputs: [{ name: "parentAId", type: "uint256" }, { name: "parentBId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "payable" },
  { type: "function", name: "canBreed", inputs: [{ name: "parentAId", type: "uint256" }, { name: "parentBId", type: "uint256" }], outputs: [{ name: "", type: "bool" }, { name: "", type: "string" }], stateMutability: "view" },
  { type: "function", name: "previewHybridElement", inputs: [{ name: "elementA", type: "uint8" }, { name: "elementB", type: "uint8" }], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "breedingFee", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "lastBreedTime", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint64" }], stateMutability: "view" },
  { type: "function", name: "breedCooldown", inputs: [], outputs: [{ name: "", type: "uint64" }], stateMutability: "view" },
  { type: "event", name: "Bred", inputs: [{ name: "parentA", type: "uint256", indexed: true }, { name: "parentB", type: "uint256", indexed: true }, { name: "childId", type: "uint256", indexed: true }, { name: "childElement", type: "uint8" }, { name: "breeder", type: "address" }] },
] as const;

export const MarketplaceAbi = [
  { type: "function", name: "listFixedPrice", inputs: [{ name: "tokenId", type: "uint256" }, { name: "price", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "listAuction", inputs: [{ name: "tokenId", type: "uint256" }, { name: "startingPrice", type: "uint256" }, { name: "duration", type: "uint64" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "buy", inputs: [{ name: "listingId", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "bid", inputs: [{ name: "listingId", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "cancelListing", inputs: [{ name: "listingId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "finalizeAuction", inputs: [{ name: "listingId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getListing", inputs: [{ name: "listingId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "listingId", type: "uint256" }, { name: "tokenId", type: "uint256" }, { name: "seller", type: "address" }, { name: "price", type: "uint256" }, { name: "listingType", type: "uint8" }, { name: "status", type: "uint8" }, { name: "highestBid", type: "uint256" }, { name: "highestBidder", type: "address" }, { name: "createdAt", type: "uint64" }, { name: "expiresAt", type: "uint64" }] }], stateMutability: "view" },
  { type: "function", name: "getActiveListingForToken", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "nextListingId", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "event", name: "Listed", inputs: [{ name: "listingId", type: "uint256", indexed: true }, { name: "tokenId", type: "uint256", indexed: true }, { name: "seller", type: "address" }, { name: "price", type: "uint256" }, { name: "listingType", type: "uint8" }] },
  { type: "event", name: "Sold", inputs: [{ name: "listingId", type: "uint256", indexed: true }, { name: "tokenId", type: "uint256", indexed: true }, { name: "seller", type: "address" }, { name: "buyer", type: "address" }, { name: "price", type: "uint256" }] },
] as const;

export const PokedexAbi = [
  { type: "function", name: "getType", inputs: [{ name: "typeId", type: "uint8" }], outputs: [{ name: "", type: "tuple", components: [{ name: "typeId", type: "uint8" }, { name: "typeName", type: "string" }, { name: "element", type: "uint8" }, { name: "description", type: "string" }, { name: "baseStats", type: "tuple", components: [{ name: "contextWindowSize", type: "uint16" }, { name: "maxConcurrentTasks", type: "uint8" }, { name: "skillSlots", type: "uint8" }, { name: "speed", type: "uint8" }, { name: "accuracy", type: "uint8" }, { name: "endurance", type: "uint8" }, { name: "creativity", type: "uint8" }] }, { name: "totalMinted", type: "uint256" }, { name: "totalActive", type: "uint256" }, { name: "totalBurned", type: "uint256" }, { name: "exists", type: "bool" }] }], stateMutability: "view" },
  { type: "function", name: "getAllTypes", inputs: [], outputs: [{ name: "", type: "tuple[]", components: [{ name: "typeId", type: "uint8" }, { name: "typeName", type: "string" }, { name: "element", type: "uint8" }, { name: "description", type: "string" }, { name: "baseStats", type: "tuple", components: [{ name: "contextWindowSize", type: "uint16" }, { name: "maxConcurrentTasks", type: "uint8" }, { name: "skillSlots", type: "uint8" }, { name: "speed", type: "uint8" }, { name: "accuracy", type: "uint8" }, { name: "endurance", type: "uint8" }, { name: "creativity", type: "uint8" }] }, { name: "totalMinted", type: "uint256" }, { name: "totalActive", type: "uint256" }, { name: "totalBurned", type: "uint256" }, { name: "exists", type: "bool" }] }], stateMutability: "view" },
  { type: "function", name: "typeCount", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
] as const;

export const StarterPackAbi = [
  { type: "function", name: "claimStarter", inputs: [{ name: "starterChoice", type: "uint8" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "canClaim", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "getStarterCounts", inputs: [], outputs: [{ name: "", type: "uint256[3]" }], stateMutability: "view" },
  { type: "function", name: "totalClaimed", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "event", name: "StarterClaimed", inputs: [{ name: "user", type: "address", indexed: true }, { name: "starterChoice", type: "uint8" }, { name: "totalClaimed", type: "uint256" }] },
] as const;
