import { BentoRegistry } from "@/config/site";

/** Safe to import from Client Components — no `fs` / Node-only APIs. */
export type BentoKey = keyof typeof BentoRegistry;

export type NavSiblingItem = { name: string; href: string; isNew?: boolean };

export type NavVisibilityPayload = Record<BentoKey, NavSiblingItem[]>;

export function resolveBentoKeyFromPathname(pathname: string): BentoKey {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p.startsWith("/transition-insight/governance") || p.startsWith("/governance")) {
    return "B2";
  }
  if (
    p.startsWith("/transition-insight/chronicle") ||
    p.startsWith("/chronicle") ||
    p === "/cord" ||
    p.startsWith("/cord/")
  ) {
    return "B3";
  }
  return "B1";
}
