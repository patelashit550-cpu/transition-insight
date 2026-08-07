export const CORD_MAX_BODY = 500;

export const CORD_OWNER_FALLBACK = "6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT";

/**
 * Return the configured Cord owner address or a safe fallback.
 * Reads NEXT_PUBLIC_SOLANA_WALLET_ADDRESS (browser-exposed env var) and
 * falls back to a constant owner address when unset.
 */
export function cordOwnerAddress(): string {
  return (process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS || "").trim() || CORD_OWNER_FALLBACK;
}

/**
 * Build a deterministic message string to sign for Cord submissions.
 * Format is a simple newline-separated bundle including address and timestamp
 * so signatures are reproducible across environments.
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
