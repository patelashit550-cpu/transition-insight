/** Browser-safe Cord helpers (no fs / server-only). */
import {
  CORD_MAX_BODY,
  CORD_OWNER_FALLBACK,
  cordOwnerAddress,
  buildCordSignMessage,
} from "@/lib/cord-shared";

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

export { CORD_MAX_BODY, CORD_OWNER_FALLBACK, cordOwnerAddress, buildCordSignMessage };
