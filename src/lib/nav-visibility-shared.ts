import { BentoRegistry } from "@/config/site";

/** Safe to import from Client Components — no `fs` / Node-only APIs. */
export type BentoKey = keyof typeof BentoRegistry;

/** One article inside a collapsible Regnum Dei pillar (tier-filtered, same gating as the hub). */
export type NavArticleItem = { name: string; href: string };

export type NavSiblingItem = {
  name: string;
  href: string;
  isNew?: boolean;
  /** Present on `collapsible` registry rows: the hub's articles, revealed when the row is opened. */
  articles?: NavArticleItem[];
};

/**
 * Routes whose URL sits under `/chronicle/` but which are listed under Telamon (B2).
 * V≡RT kept its original URL when it moved from Bento 3 to Bento 2.
 */
const B2_CHRONICLE_ROUTES = ["/chronicle/argonaut-agentic", "/transition-insight/chronicle/argonaut-agentic"];

function isAtOrUnder(p: string, base: string): boolean {
  return p === base || p.startsWith(`${base}/`);
}

export type NavVisibilityPayload = Record<BentoKey, NavSiblingItem[]>;

export function resolveBentoKeyFromPathname(pathname: string): BentoKey {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p.startsWith("/transition-insight/governance") || p.startsWith("/governance")) {
    return "B2";
  }
  if (B2_CHRONICLE_ROUTES.some((base) => isAtOrUnder(p, base))) {
    return "B2";
  }
  if (
    // Chronicle hubs (Lens): Jack London, Polite Bureau, Skin in the Game, London Calling.
    p.startsWith("/transition-insight/chronicle") ||
    p.startsWith("/chronicle")
  ) {
    return "B3";
  }
  return "B1";
}
