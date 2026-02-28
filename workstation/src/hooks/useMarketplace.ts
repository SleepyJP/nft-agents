import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { MarketplaceAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/chains";

const MARKET_ADDRESS = CONTRACTS.Marketplace;

export function useListing(listingId: bigint | undefined) {
  return useReadContract({
    address: MARKET_ADDRESS,
    abi: MarketplaceAbi,
    functionName: "getListing",
    args: listingId !== undefined ? [listingId] : undefined,
    query: { enabled: listingId !== undefined },
  });
}

export function useActiveListingForToken(tokenId: bigint | undefined) {
  return useReadContract({
    address: MARKET_ADDRESS,
    abi: MarketplaceAbi,
    functionName: "getActiveListingForToken",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useNextListingId() {
  return useReadContract({
    address: MARKET_ADDRESS,
    abi: MarketplaceAbi,
    functionName: "nextListingId" as any,
    query: { enabled: true },
  });
}

export function useListFixedPrice() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const list = (tokenId: bigint, price: bigint) => {
    writeContract({
      address: MARKET_ADDRESS,
      abi: MarketplaceAbi,
      functionName: "listFixedPrice",
      args: [tokenId, price],
    });
  };

  return { list, hash, isPending, isConfirming, isSuccess, error };
}

export function useListAuction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const listAuction = (tokenId: bigint, startingPrice: bigint, duration: bigint) => {
    writeContract({
      address: MARKET_ADDRESS,
      abi: MarketplaceAbi,
      functionName: "listAuction",
      args: [tokenId, startingPrice, duration],
    });
  };

  return { listAuction, hash, isPending, isConfirming, isSuccess, error };
}

export function useBuyListing() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const buy = (listingId: bigint, price: bigint) => {
    writeContract({
      address: MARKET_ADDRESS,
      abi: MarketplaceAbi,
      functionName: "buy",
      args: [listingId],
      value: price,
    });
  };

  return { buy, hash, isPending, isConfirming, isSuccess, error };
}

export function usePlaceBid() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const bid = (listingId: bigint, amount: bigint) => {
    writeContract({
      address: MARKET_ADDRESS,
      abi: MarketplaceAbi,
      functionName: "bid",
      args: [listingId],
      value: amount,
    });
  };

  return { bid, hash, isPending, isConfirming, isSuccess, error };
}

export function useCancelListing() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancel = (listingId: bigint) => {
    writeContract({
      address: MARKET_ADDRESS,
      abi: MarketplaceAbi,
      functionName: "cancelListing",
      args: [listingId],
    });
  };

  return { cancel, hash, isPending, isConfirming, isSuccess };
}

export function useFinalizeAuction() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const finalize = (listingId: bigint) => {
    writeContract({
      address: MARKET_ADDRESS,
      abi: MarketplaceAbi,
      functionName: "finalizeAuction",
      args: [listingId],
    });
  };

  return { finalize, hash, isPending, isConfirming, isSuccess };
}
