import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "NFT Agents — Pokémon-Style AI Agent Workstation",
  description: "Collect, evolve, battle, and use AI Agent NFTs. Plug them into your workstation.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-void-900 text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
