import { useReadContract } from "wagmi";
import { PokedexAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/chains";

const POKEDEX_ADDRESS = CONTRACTS.Pokedex;

export function usePokedexType(typeId: number) {
  return useReadContract({
    address: POKEDEX_ADDRESS,
    abi: PokedexAbi,
    functionName: "getType",
    args: [typeId],
  });
}

export function useAllPokedexTypes() {
  return useReadContract({
    address: POKEDEX_ADDRESS,
    abi: PokedexAbi,
    functionName: "getAllTypes",
  });
}

export function usePokedexTypeCount() {
  return useReadContract({
    address: POKEDEX_ADDRESS,
    abi: PokedexAbi,
    functionName: "typeCount",
  });
}
