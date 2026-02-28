import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS } from "@/lib/chains";

const X404_ADDRESS = CONTRACTS.X404PaymentRouter;

// X404 Payment Router ABI (frontend-facing functions)
const X404Abi = [
  // Revenue stats
  { type: "function", name: "getRevenueStats", inputs: [], outputs: [{ name: "_totalRevenue", type: "uint256" }, { name: "_totalDistributed", type: "uint256" }, { name: "_totalAgentPayments", type: "uint256" }, { name: "_sourceCount", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getRevenueByType", inputs: [{ name: "sourceType", type: "string" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getAgentBalance", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getPayment", inputs: [{ name: "paymentId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "paymentId", type: "uint256" }, { name: "fromTokenId", type: "uint256" }, { name: "toTokenId", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "paymentType", type: "string" }, { name: "timestamp", type: "uint64" }] }], stateMutability: "view" },
  { type: "function", name: "isSubscriptionActive", inputs: [{ name: "subId", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "totalRevenue", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalAgentPayments", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  // Write
  { type: "function", name: "fundAgent", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "depositToTreasury", inputs: [], outputs: [], stateMutability: "payable" },
  { type: "function", name: "createSubscription", inputs: [{ name: "agentTokenId", type: "uint256" }, { name: "pricePerPeriod", type: "uint256" }, { name: "periodSeconds", type: "uint64" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "renewSubscription", inputs: [{ name: "subId", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "cancelSubscription", inputs: [{ name: "subId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  // Events
  { type: "event", name: "RevenueReceived", inputs: [{ name: "sourceId", type: "uint256", indexed: true }, { name: "sourceType", type: "string" }, { name: "amount", type: "uint256" }, { name: "from", type: "address" }] },
  { type: "event", name: "AgentPaymentMade", inputs: [{ name: "paymentId", type: "uint256", indexed: true }, { name: "fromAgent", type: "uint256" }, { name: "toAgent", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "paymentType", type: "string" }] },
  { type: "event", name: "AgentFunded", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "amount", type: "uint256" }, { name: "funder", type: "address" }] },
  { type: "event", name: "SubscriptionCreated", inputs: [{ name: "subId", type: "uint256", indexed: true }, { name: "subscriber", type: "address" }, { name: "agentTokenId", type: "uint256" }, { name: "price", type: "uint256" }] },
] as const;

// ---------------------------------------------------------------
// READ HOOKS
// ---------------------------------------------------------------

export function useRevenueStats() {
  return useReadContract({
    address: X404_ADDRESS,
    abi: X404Abi,
    functionName: "getRevenueStats",
  });
}

export function useTotalRevenue() {
  return useReadContract({
    address: X404_ADDRESS,
    abi: X404Abi,
    functionName: "totalRevenue",
  });
}

export function useRevenueByType(sourceType: string) {
  return useReadContract({
    address: X404_ADDRESS,
    abi: X404Abi,
    functionName: "getRevenueByType",
    args: [sourceType],
  });
}

export function useX404AgentBalance(tokenId: bigint | undefined) {
  return useReadContract({
    address: X404_ADDRESS,
    abi: X404Abi,
    functionName: "getAgentBalance",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function usePaymentData(paymentId: bigint | undefined) {
  return useReadContract({
    address: X404_ADDRESS,
    abi: X404Abi,
    functionName: "getPayment",
    args: paymentId !== undefined ? [paymentId] : undefined,
    query: { enabled: paymentId !== undefined },
  });
}

export function useSubscriptionActive(subId: bigint | undefined) {
  return useReadContract({
    address: X404_ADDRESS,
    abi: X404Abi,
    functionName: "isSubscriptionActive",
    args: subId !== undefined ? [subId] : undefined,
    query: { enabled: subId !== undefined },
  });
}

// ---------------------------------------------------------------
// WRITE HOOKS
// ---------------------------------------------------------------

export function useFundAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const fund = (tokenId: bigint, amount: bigint) => {
    writeContract({
      address: X404_ADDRESS,
      abi: X404Abi,
      functionName: "fundAgent",
      args: [tokenId],
      value: amount,
    });
  };

  return { fund, hash, isPending, isConfirming, isSuccess, error };
}

export function useDepositToTreasury() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const deposit = (amount: bigint) => {
    writeContract({
      address: X404_ADDRESS,
      abi: X404Abi,
      functionName: "depositToTreasury",
      value: amount,
    });
  };

  return { deposit, hash, isPending, isConfirming, isSuccess, error };
}

export function useCreateSubscription() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const subscribe = (agentTokenId: bigint, pricePerPeriod: bigint, periodSeconds: bigint) => {
    writeContract({
      address: X404_ADDRESS,
      abi: X404Abi,
      functionName: "createSubscription",
      args: [agentTokenId, pricePerPeriod, periodSeconds],
      value: pricePerPeriod,
    });
  };

  return { subscribe, hash, isPending, isConfirming, isSuccess, error };
}

export function useRenewSubscription() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const renew = (subId: bigint, price: bigint) => {
    writeContract({
      address: X404_ADDRESS,
      abi: X404Abi,
      functionName: "renewSubscription",
      args: [subId],
      value: price,
    });
  };

  return { renew, hash, isPending, isConfirming, isSuccess, error };
}

export function useCancelSubscription() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancel = (subId: bigint) => {
    writeContract({
      address: X404_ADDRESS,
      abi: X404Abi,
      functionName: "cancelSubscription",
      args: [subId],
    });
  };

  return { cancel, hash, isPending, isConfirming, isSuccess };
}
