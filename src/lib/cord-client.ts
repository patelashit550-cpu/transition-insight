/** Browser-safe Cord helpers (no fs / server-only). */

export const CORD_MAX_BODY = 500;

/** Public owner address — same as provenance / Connexion strip. */
export const CORD_OWNER_FALLBACK = "6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT";

/**
 * Return the configured Cord owner address or a safe fallback.
 *
 * Reads NEXT_PUBLIC_SOLANA_WALLET_ADDRESS (browser-exposed env var) and
 * falls back to a constant owner address when unset.
 *
 * @returns Solana-style owner address string
 */
export function cordOwnerAddress(): string {
  return (process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS || "").trim() || CORD_OWNER_FALLBACK;
}

/**
 * Build a deterministic message string to sign for Cord submissions.
 *
 * Format is a simple newline-separated bundle including address and timestamp
 * so signatures are reproducible across environments.
 *
 * @param address - wallet/address string to attribute the message to
 * @param timestamp - epoch milliseconds used to bind the message to a time
 * @param body - content body to include in the signed payload
 * @returns canonical multi-line message string to sign
 */
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
/**
 * Obtain the injected Phantom provider if available and verified.
 *
 * This is safe to call in browser contexts; returns `null` on server.
 *
 * @returns PhantomProvider when Phantom exists on window, otherwise null
 */
export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const phantom = (window as PhantomWindow).phantom?.solana;
  return phantom?.isPhantom ? phantom : null;
}

/**
 * Convenience boolean check for Phantom availability.
 *
 * @returns true when a Phantom provider is present in the browser, false otherwise
 */
export function isPhantomProviderAvailable(): boolean {
  return getPhantomProvider() !== null;
}

/**
 * Open the Phantom installation page in a new tab.
 *
 * Browser-only helper used to guide users to install Phantom when missing.
 */
export function openPhantomInstall(): void {
  window.open(PHANTOM_INSTALL_URL, "_blank", "noopener,noreferrer");
}
