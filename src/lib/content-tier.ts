/**
 * Content gating tiers:
 *
 * - **local:** `next dev` default — all `stage` values, drafts in nav/menus/routes.
 * - **preprod:** `NEXT_PUBLIC_CONTENT_TIER=preprod` on **`next build`** — `review` /
 *   `published` / `canonical` only (`draft` stays dev-only until you bump to **`review`**).
 *   Never point prod IPNS/DNS/SNS at a preprod CID.
 * - **global:** public surfaces — only `published` / `canonical` in export and menus.
 *
 * Set `NEXT_PUBLIC_CONTENT_TIER` to `local` | `preprod` | `global`. Legacy: `dev` → local,
 * `prod` → global; `staging` → preprod (`qa` stays **local**, same as before).
 *
 * When unset: `next dev` → local; `next build` → global (published only).
 */
export type ContentTier = "local" | "preprod" | "global";

const CANON = /^(local|preprod|global)$/i;
/** Legacy env values */
const LEGACY: Record<string, ContentTier> = {
  dev: "local",
  prod: "global",
  qa: "local",
  staging: "preprod",
};

export function getContentBuildTier(): ContentTier {
  const raw = process.env.NEXT_PUBLIC_CONTENT_TIER?.trim();
  if (raw) {
    const k = raw.toLowerCase();
    if (CANON.test(k)) {
      return k as ContentTier;
    }
    if (k in LEGACY) {
      return LEGACY[k]!;
    }
  }
  if (process.env.NODE_ENV === "development") {
    return "local";
  }
  return "global";
}

/**
 * Tier for **bundled routes, topic INDEX menus, and static-export param discovery**.
 *
 * In **`NODE_ENV=production`** only **`preprod`** includes **`review`** (plus published
 * tiers) for QA artifacts — not raw **`draft`**. **`local`** in production is ignored and treated like **`global`**
 * so stray env cannot ship studio content by mistake.
 */
export function getPublishingContentTier(): ContentTier {
  if (process.env.NODE_ENV === "production") {
    const tier = getContentBuildTier();
    return tier === "preprod" ? "preprod" : "global";
  }
  return getContentBuildTier();
}

/** Normalize frontmatter: missing or invalid → `draft` (strict global hides). */
export function normalizeStage(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().toLowerCase();
  }
  return "draft";
}

/**
 * Which routes get static HTML in `out/` and which files are listable in topic views.
 * Does **not** apply `showInNav` — that is nav-only; published-but-hidden is still a URL.
 */
export function isStageIncludedInBuild(stage: string, tier: ContentTier = getPublishingContentTier()): boolean {
  const s = normalizeStage(stage);
  if (tier === "global") {
    return s === "published" || s === "canonical";
  }
  if (tier === "preprod") {
    return s === "review" || s === "published" || s === "canonical";
  }
  return true;
}

/**
 * Home bento + narrative header series rows: gate file must exist and the gate `stage`
 * must be included for the **current content tier** (preprod respects `review`, not `draft`).
 * No gate file → `data` null → row hidden. **`showInNav`** is not read here.
 */
export function isNavSeriesItemVisible(
  _bentoKey: "B1" | "B2" | "B3",
  data: Record<string, unknown> | null,
  tier: ContentTier = getContentBuildTier()
): boolean {
  if (!data) return false;
  // showInNav: true is an explicit override — unlocks nav in local/preprod without requiring published stage
  if (data.showInNav === true && tier !== "global") return true;
  const stage = normalizeStage(data.stage);
  return isStageIncludedInBuild(stage, tier);
}
