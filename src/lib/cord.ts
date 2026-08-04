import "server-only";

import fs from "fs";
import path from "path";

import bs58 from "bs58";
import nacl from "tweetnacl";

export type CordPost = {
  id: string;
  body: string;
  createdAt: string;
  address: string;
};

export type CordFeed = {
  updatedAt: string;
  posts: CordPost[];
};

export const CORD_MAX_BODY = 500;
export const CORD_SIGN_WINDOW_MS = 5 * 60 * 1000;

const FEED_PATH = path.join(process.cwd(), "public", "cord", "feed.json");

export function cordOwnerAddress(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS || "").trim();
  if (fromEnv) return fromEnv;
  // Public allowlist fallback (same address as provenance) so local.devtools works
  // when only `.env.production` defines NEXT_PUBLIC_SOLANA_WALLET_ADDRESS.
  return "6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT";
}

export function isCordPrototypeEnabled(): boolean {
  // Local next.devtools only — static global export stays web1 / no write surface.
  if (process.env.NODE_ENV === "development") return true;
  return process.env.NEXT_PUBLIC_CONTENT_TIER?.trim().toLowerCase() === "local";
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

export function readCordFeed(): CordFeed {
  try {
    const raw = fs.readFileSync(FEED_PATH, "utf8");
    const data = JSON.parse(raw) as CordFeed;
    if (!data || !Array.isArray(data.posts)) {
      return { updatedAt: new Date().toISOString(), posts: [] };
    }
    return data;
  } catch {
    return { updatedAt: new Date().toISOString(), posts: [] };
  }
}

export function writeCordFeed(feed: CordFeed): void {
  fs.mkdirSync(path.dirname(FEED_PATH), { recursive: true });
  fs.writeFileSync(FEED_PATH, `${JSON.stringify(feed, null, 2)}\n`, "utf8");
}

export function verifyCordSignature(params: {
  address: string;
  timestamp: number;
  body: string;
  signatureBase58: string;
}): { ok: true } | { ok: false; error: string } {
  const owner = cordOwnerAddress();
  if (!owner) return { ok: false, error: "Owner address not configured" };
  if (params.address !== owner) return { ok: false, error: "Address is not the Chord owner" };

  const age = Date.now() - params.timestamp;
  if (!Number.isFinite(params.timestamp) || age < -30_000 || age > CORD_SIGN_WINDOW_MS) {
    return { ok: false, error: "Signature timestamp out of window" };
  }

  const body = params.body.trim();
  if (!body) return { ok: false, error: "Empty post" };
  if (body.length > CORD_MAX_BODY) return { ok: false, error: `Max ${CORD_MAX_BODY} characters` };

  let signature: Uint8Array;
  let publicKeyBytes: Uint8Array;
  try {
    signature = bs58.decode(params.signatureBase58);
    publicKeyBytes = bs58.decode(params.address);
  } catch {
    return { ok: false, error: "Invalid address or signature encoding" };
  }

  const message = buildCordSignMessage(params.address, params.timestamp, body);
  const messageBytes = new TextEncoder().encode(message);

  const valid = nacl.sign.detached.verify(messageBytes, signature, publicKeyBytes);
  if (!valid) return { ok: false, error: "Invalid signature" };
  return { ok: true };
}
