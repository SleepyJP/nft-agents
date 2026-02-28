"use client";

import { useState, useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { formatEther, parseEther } from "viem";
import { ELEMENT_COLORS, ELEMENT_NAMES, LISTING_TYPE_NAMES, LISTING_STATUS_NAMES } from "@/lib/constants";
import { MarketplaceAbi, AgentNFTAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/chains";
import { useAgentBalance, useOwnedAgents, useMultipleAgentData, parseAgentData, useApproveNFT } from "@/hooks/useAgentNFT";
import { useNextListingId, useListFixedPrice, useBuyListing, usePlaceBid, useCancelListing } from "@/hooks/useMarketplace";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ElementType } from "@/types/agent";

export default function MarketplaceView() {
  const [filter, setFilter] = useState<ElementType | "ALL">("ALL");
  const [listTokenId, setListTokenId] = useState("");
  const [listPrice, setListPrice] = useState("");

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

  // Fetch marketplace listings
  const { data: nextListingIdRaw } = useNextListingId();
  const nextListingId = nextListingIdRaw ? Number(nextListingIdRaw) : 1;

  const listingIds = useMemo(() => {
    const ids: bigint[] = [];
    const max = Math.min(nextListingId - 1, 30);
    for (let i = 1; i <= max; i++) {
      ids.push(BigInt(i));
    }
    return ids;
  }, [nextListingId]);

  const listingContracts = listingIds.map((id) => ({
    address: CONTRACTS.Marketplace,
    abi: MarketplaceAbi,
    functionName: "getListing" as const,
    args: [id] as const,
  }));

  const { data: listingsResult } = useReadContracts({
    contracts: listingContracts.length > 0 ? listingContracts : [],
    query: { enabled: listingContracts.length > 0 },
  });

  // Parse listings
  const rawListings = (listingsResult || [])
    .map((r) => {
      if (r.status !== "success" || !r.result) return null;
      const l = r.result as any;
      return {
        listingId: Number(l.listingId),
        tokenId: Number(l.tokenId),
        seller: l.seller as string,
        price: l.price as bigint,
        listingType: Number(l.listingType),
        status: Number(l.status),
        highestBid: l.highestBid as bigint,
        highestBidder: l.highestBidder as string,
        createdAt: Number(l.createdAt),
        expiresAt: Number(l.expiresAt),
      };
    })
    .filter(Boolean)
    .filter((l) => l!.status === 0) as NonNullable<any>[]; // Only ACTIVE listings

  // Fetch agent data for listed tokens
  const listedTokenIds = rawListings.map(l => BigInt(l.tokenId));
  const agentDataContracts = listedTokenIds.map((id) => ({
    address: CONTRACTS.AgentNFT,
    abi: AgentNFTAbi,
    functionName: "getAgent" as const,
    args: [id] as const,
  }));

  const { data: listedAgentData } = useReadContracts({
    contracts: agentDataContracts.length > 0 ? agentDataContracts : [],
    query: { enabled: agentDataContracts.length > 0 },
  });

  const listings = rawListings.map((l, i) => {
    const agentResult = listedAgentData?.[i];
    let agent = null;
    if (agentResult?.status === "success" && agentResult.result) {
      agent = parseAgentData(agentResult.result);
    }
    return { ...l, agent };
  });

  const filteredListings = listings.filter((item) =>
    filter === "ALL" ? true : item.agent?.element === filter
  );

  const { list, isPending: isListing } = useListFixedPrice();
  const { buy, isPending: isBuying } = useBuyListing();
  const { bid, isPending: isBidding } = usePlaceBid();
  const { cancel: cancelListing, isPending: isCancelling } = useCancelListing();
  const { setApprovalForAll, isPending: isApproving } = useApproveNFT();

  if (!isConnected) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-6">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white">Marketplace</h2>
        <p className="text-sm text-white/40">Connect your wallet to browse the marketplace</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-wide text-white">
            Marketplace
          </h2>
          <p className="mt-1 text-sm text-white/40">
            Browse and acquire new agents for your fleet
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("ALL")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              filter === "ALL" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"
            }`}
          >
            All
          </button>
          {(["FIRE", "WATER", "ELECTRIC", "PSYCHIC", "DARK", "DRAGON", "STEEL", "EARTH", "GHOST", "NATURE"] as ElementType[]).map((el) => (
            <button
              key={el}
              onClick={() => setFilter(filter === el ? "ALL" : el)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === el ? "text-white" : "text-white/30 hover:text-white/50"
              }`}
              style={filter === el ? { backgroundColor: `${ELEMENT_COLORS[el].primary}20`, color: ELEMENT_COLORS[el].primary } : undefined}
            >
              {el}
            </button>
          ))}
        </div>
      </div>

      {/* List Agent */}
      {agents.length > 0 && (
        <div className="glass-card space-y-4 p-6">
          <h3 className="font-display text-sm font-semibold text-white/70">List Your Agent</h3>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/30">Agent</label>
              <select
                value={listTokenId}
                onChange={(e) => setListTokenId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-void-800 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Select agent</option>
                {agents.map((a) => (
                  <option key={Number(a.tokenId)} value={a.tokenId.toString()}>
                    #{Number(a.tokenId)} ({a.element} Lv.{a.level})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/30">Price (JASMY)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-void-800 px-3 py-2 text-sm text-white outline-none"
                placeholder="10"
              />
            </div>
            <button
              disabled={isApproving}
              onClick={() => setApprovalForAll(CONTRACTS.Marketplace, true)}
              className="rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white/50 transition-all hover:bg-white/10"
            >
              {isApproving ? "Approving..." : "Approve"}
            </button>
            <button
              disabled={!listTokenId || !listPrice || isListing}
              onClick={() => {
                if (listTokenId && listPrice) {
                  list(BigInt(listTokenId), parseEther(listPrice));
                }
              }}
              className="rounded-xl bg-gradient-to-r from-neon-purple to-neon-blue px-6 py-2.5 font-display text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-neon-purple/20 disabled:opacity-40"
            >
              {isListing ? "Listing..." : "List"}
            </button>
          </div>
        </div>
      )}

      {/* Listings Grid */}
      {filteredListings.length > 0 ? (
        <div className="grid grid-cols-3 gap-6">
          {filteredListings.map((item) => {
            const agent = item.agent;
            const element = agent?.element as ElementType | undefined;
            const colors = element ? ELEMENT_COLORS[element] : { primary: "#a855f7", secondary: "#6366f1", accent: "#a855f7" };
            const isAuction = item.listingType === 1;
            const isOwn = address && item.seller.toLowerCase() === address.toLowerCase();

            return (
              <div
                key={item.listingId}
                className={`glass-card group cursor-pointer overflow-hidden p-5 ${agent?.isShiny ? "holographic" : ""}`}
                style={{ borderColor: `${colors.primary}15` }}
              >
                {/* Glow */}
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-15 blur-3xl transition-opacity group-hover:opacity-30"
                  style={{ backgroundColor: colors.primary }}
                />

                {/* Header */}
                <div className="relative flex items-start justify-between">
                  <div>
                    <h4 className="font-display text-base font-bold" style={{ color: colors.primary }}>
                      Agent #{item.tokenId}
                    </h4>
                    <div className="mt-1 flex gap-1.5">
                      {element && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                          style={{ backgroundColor: `${colors.primary}20`, color: colors.primary }}
                        >
                          {element}
                        </span>
                      )}
                      {agent?.isShiny && (
                        <span className="rounded bg-yellow-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-yellow-400">SHINY</span>
                      )}
                      {agent?.isGenesis && (
                        <span className="rounded bg-purple-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-purple-400">GENESIS</span>
                      )}
                    </div>
                  </div>
                  {isAuction && (
                    <span className="rounded-md bg-neon-purple/20 px-2 py-0.5 text-[9px] font-bold text-neon-purple">
                      AUCTION
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div
                  className="my-4 flex h-24 items-center justify-center rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${colors.primary}08, ${colors.secondary}08)` }}
                >
                  <span className="font-display text-3xl font-bold opacity-30" style={{ color: colors.primary }}>
                    {element ? element.charAt(0) : "?"}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30">
                    {agent ? `Lv.${agent.level} | ${agent.evolutionStage}` : "Loading..."}
                  </span>
                  <span className="text-white/20">
                    {item.seller.slice(0, 6)}...{item.seller.slice(-4)}
                  </span>
                </div>

                {/* Price + Action */}
                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                  <div>
                    <p className="font-mono text-lg font-bold text-white">
                      {formatEther(item.price)} JASMY
                    </p>
                    {isAuction && item.highestBid > BigInt(0) && (
                      <p className="text-[10px] text-white/30">
                        Highest bid: {formatEther(item.highestBid)} JASMY
                      </p>
                    )}
                  </div>
                  {isOwn ? (
                    <button
                      disabled={isCancelling}
                      onClick={() => cancelListing(BigInt(item.listingId))}
                      className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400/70 transition-all hover:bg-red-500/20"
                    >
                      {isCancelling ? "..." : "Cancel"}
                    </button>
                  ) : (
                    <button
                      disabled={isBuying || isBidding}
                      onClick={() => {
                        if (isAuction) {
                          bid(BigInt(item.listingId), item.price);
                        } else {
                          buy(BigInt(item.listingId), item.price);
                        }
                      }}
                      className="rounded-xl px-5 py-2 text-sm font-bold text-white transition-all hover:shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                        boxShadow: `0 4px 15px ${colors.primary}30`,
                      }}
                    >
                      {isBuying || isBidding ? "..." : isAuction ? "Bid" : "Buy"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card flex h-48 items-center justify-center">
          <p className="text-sm text-white/20">No active listings found</p>
        </div>
      )}
    </div>
  );
}
