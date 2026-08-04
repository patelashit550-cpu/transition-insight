/**
 * Server-only (uses `fs`). Import only from Server Components / `layout` / pages — never from `'use client'` modules.
 */
import fs from "fs";
import matter from "gray-matter";

import { BentoRegistry } from "@/config/site";
import { BENTO_ROUTE_ONTOLOGY } from "@/lib/content-paths";
import { CONTENT_HUBS, type ContentHubKey } from "@/lib/content-routes";
import { isNavSeriesItemVisible, getContentBuildTier, type ContentTier } from "@/lib/content-tier";
import {
  getEssayInTopic,
  getProfileData,
  listEssays,
  listEssaysBySeries,
  listEssaysInTopicFolder,
  resolveOntologyFilePath,
} from "@/lib/markdown";
import type { BentoKey, NavSiblingItem, NavVisibilityPayload } from "@/lib/nav-visibility-shared";

export type { BentoKey, NavSiblingItem, NavVisibilityPayload } from "@/lib/nav-visibility-shared";

/** Map public `href` → ontology-relative path for nav gate frontmatter reads. */
function hrefToRelOntology(href: string): string {
  let rel = href.replace(/^\//, "");
  if (rel.startsWith("transition-insight/identity/")) {
    rel = rel.replace("transition-insight/identity/", "me/");
  } else if (rel.startsWith("transition-insight/governance/")) {
    rel = rel.replace("transition-insight/governance/", "governance/");
  } else if (rel.startsWith("transition-insight/chronicle/")) {
    rel = rel.replace("transition-insight/chronicle/", "chronicle/");
  } else if (rel.startsWith("transition-insight/")) {
    rel = rel.slice("transition-insight/".length);
  }
  if (rel in BENTO_ROUTE_ONTOLOGY) {
    rel = BENTO_ROUTE_ONTOLOGY[rel]!;
  }
  return rel;
}

function tryReadFrontmatter(fp: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(fp, "utf8");
    return matter(raw).data as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Frontmatter that gates nav visibility for a registry `href`.
 * - Single-file essay: read that file.
 * - Topic folder: read the **first essay** after `listEssays` sort (order, then filename).
 *   To change which file gates a topic, set `order` in frontmatter so the intended essay sorts first.
 */
function readNavGateFrontmatter(relFromOntology: string): Record<string, unknown> | null {
  const single = resolveOntologyFilePath(relFromOntology);
  if (single) return tryReadFrontmatter(single);

  const parts = relFromOntology.split("/").filter(Boolean);
  for (let depth = parts.length; depth >= 2; depth--) {
    const topicParts = parts.slice(0, depth);
    const essays = listEssays(topicParts);
    if (essays.length === 0) continue;

    const essay = getEssayInTopic(topicParts, essays[0].slug);
    if (!essay) continue;
    return essay.frontmatter as Record<string, unknown>;
  }

  return null;
}

/** Rolling window for `isNew` (gate `publishedAt` vs build/runtime `Date.now()`). */
const NEW_HIGHLIGHT_DAYS = 14;

function getPublicationTimeMs(data: Record<string, unknown> | null): number | null {
  if (!data) return null;
  const raw = data.publishedAt;
  if (raw == null) return null;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string") {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

function isWithinNewHighlightWindow(
  data: Record<string, unknown> | null,
  days: number
): boolean {
  const t = getPublicationTimeMs(data);
  if (t == null) return false;
  const ageMs = Date.now() - t;
  if (ageMs < 0) return false;
  return ageMs < days * 24 * 60 * 60 * 1000;
}

function frontmatterForEssaySlug(slug: string, topicPath?: readonly string[]): Record<string, unknown> | null {
  if (topicPath?.length) {
    const inTopic = getEssayInTopic([...topicPath], slug);
    if (inTopic) return inTopic.frontmatter as Record<string, unknown>;
  }
  const profile = getProfileData([slug]);
  return profile ? (profile.frontmatter as Record<string, unknown>) : null;
}

/** Hub rows flash when any essay in the hub was published within the highlight window. */
function isHrefNew(href: string, relFromOntology: string): boolean {
  const hubKey = href.replace(/^\//, "") as ContentHubKey;
  if (hubKey in CONTENT_HUBS) {
    const config = CONTENT_HUBS[hubKey];
    const stubs =
      config.mode === "folder"
        ? listEssaysInTopicFolder([...config.ontologyTopicPath], { series: config.seriesSlug })
        : listEssaysBySeries(config.seriesName);

    return stubs.some((stub) => {
      const topicPath = config.mode === "folder" ? config.ontologyTopicPath : undefined;
      const fm = frontmatterForEssaySlug(stub.slug, topicPath);
      return isWithinNewHighlightWindow(fm, NEW_HIGHLIGHT_DAYS);
    });
  }

  return isWithinNewHighlightWindow(readNavGateFrontmatter(relFromOntology), NEW_HIGHLIGHT_DAYS);
}

/**
 * B1 / B2 / B3: each series row shows when the gate file exists and
 * `isNavSeriesItemVisible` passes (`global` → published/canonical; `preprod` →
 * `review` + published; `local` → all stages).
 */
function filterSeries(
  bentoKey: BentoKey,
  tier: ContentTier
): NavSiblingItem[] {
  const section = BentoRegistry[bentoKey];
  const out: NavSiblingItem[] = [];
  for (const item of section.series) {
    const href = item.href as string;
    const rel = hrefToRelOntology(href);
    const data = readNavGateFrontmatter(rel);
    if (!isNavSeriesItemVisible(bentoKey, data, tier)) continue;
    out.push({
      name: item.name,
      href,
      isNew: isHrefNew(href, rel),
    });
  }
  return out;
}

let _navVisibilityMemo: NavVisibilityPayload | undefined;

/**
 * One synchronous pass over content/ per Node process. Avoids React `cache()` here —
 * some Next.js build workers have crashed when `cache()` wraps fs-backed work used from root `layout`.
 */
export function getNavVisibilityPayload(): NavVisibilityPayload {
  const tier = getContentBuildTier();
  // In dev, frontmatter changes frequently; avoid stale memoized nav state.
  if (process.env.NODE_ENV === "development") {
    return {
      B1: filterSeries("B1", tier),
      B2: filterSeries("B2", tier),
      B3: filterSeries("B3", tier),
    };
  }
  if (_navVisibilityMemo) return _navVisibilityMemo;
  _navVisibilityMemo = {
    B1: filterSeries("B1", tier),
    B2: filterSeries("B2", tier),
    B3: filterSeries("B3", tier),
  };
  return _navVisibilityMemo;
}
