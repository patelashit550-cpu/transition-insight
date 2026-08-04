/** Browser-safe Cord helpers (no fs / server-only). */

export const CORD_MAX_BODY = 500;

/** Public owner address — same as provenance / Connexion strip. */
export const CORD_OWNER_FALLBACK = "6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT";

export function cordOwnerAddress(): string {
  return (process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS || "").trim() || CORD_OWNER_FALLBACK;
}

export function buildCordSignMessage(address: string, timestamp: number, body: string): string {
  return [
    "Transition Insight Chord",
    "",
    `Address: ${address}`,
    `Timestamp: ${timestamp}`,
    "Content:",
    body.trim(),
  ].join("\n");
}

/** Phantom extension — Cord compose is owner-only and uses Phantom explicitly. */
export const PHANTOM_INSTALL_URL = "https://phantom.app/";

export type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  signMessage: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
};

type PhantomWindow = Window & {
  phantom?: { solana?: PhantomProvider };
};

/** Phantom’s supported injection point — not legacy `window.solana` (Glow and others hijack that). */
export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const phantom = (window as PhantomWindow).phantom?.solana;
  return phantom?.isPhantom ? phantom : null;
}

export function isPhantomProviderAvailable(): boolean {
  return getPhantomProvider() !== null;
}

export function openPhantomInstall(): void {
  window.open(PHANTOM_INSTALL_URL, "_blank", "noopener,noreferrer");
}
