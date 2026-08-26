import fs from "fs";
import path from "path";
import matter from "gray-matter";

import {
  getPublishingContentTier,
  isStageIncludedInBuild,
  normalizeStage,
  type ContentTier,
} from "@/lib/content-tier";
import { ONTOLOGY_ROOT } from "@/lib/content-paths";
import { essayNavDate } from "@/lib/essay-date";

const EXTS = [".mdx", ".md"] as const;

export interface EssayStub {
  slug: string;
  title: string;
  order: number;
  /** Epoch ms from `publishedAt` or `date` — for chrono nav sort. */
  dateMs?: number;
  /** ISO `YYYY-MM-DD` for `<time datetime>`. */
  dateIso?: string;
  /** Display stamp in margin nav (e.g. `2026.07.06`). */
  dateLabel?: string;
}

function publicationTimeMs(data: Record<string, unknown> | null | undefined): number | null {
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

function seriesNamesFromFrontmatter(data: Record<string, unknown>): string[] {
  const raw = data.series;
  if (typeof raw === "string" && raw.trim()) return [raw.trim().toLowerCase()];
  if (Array.isArray(raw)) {
    return raw
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim().toLowerCase());
  }
  return [];
}

function essayStubFromFilename(filename: string): EssayStub & { _filename: string } {
  const full = path.join(ONTOLOGY_ROOT, filename);
  let order = Number.POSITIVE_INFINITY;
  let title = path.basename(filename).replace(/\.(mdx|md)$/i, "");
  let data: Record<string, unknown> = {};
  try {
    data = matter(fs.readFileSync(full, "utf8")).data as Record<string, unknown>;
    if (typeof data.order === "number") order = data.order;
    if (typeof data.title === "string" && data.title.trim()) title = data.title;
  } catch {
    /* keep defaults */
  }
  const navDate = essayNavDate(data);
  return {
    slug: essaySlugFromFile(filename, data),
    title,
    order,
    ...(navDate
      ? { dateMs: navDate.ms, dateIso: navDate.iso, dateLabel: navDate.label }
      : {}),
    _filename: filename,
  };
}

function sortEssayStubs<T extends EssayStub & { _filename: string }>(stubs: T[]): T[] {
  return [...stubs].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a._filename.localeCompare(b._filename);
  });
}

/** Hub index target: most recent `publishedAt`, else highest `order`, else first sorted stub. */
/**
 * Choose the most appropriate essay slug for a hub index.
 *
 * Preference order:
 *  1. Most recent `publishedAt` (dateMs) if available
 *  2. Highest frontmatter `order`
 *  3. First stub sorted by filename
 *
 * @param essays - array of EssayStub objects
 * @returns slug of the chosen essay or null when the list is empty
 */
export function pickLatestEssaySlug(essays: EssayStub[]): string | null {
  if (essays.length === 0) return null;

  const withPub = essays.filter((e) => typeof e.dateMs === "number");
  if (withPub.length > 0) {
    const ranked = [...withPub].sort(
      (a, b) => b.dateMs! - a.dateMs! || a.slug.localeCompare(b.slug)
    );
    return ranked[0]!.slug;
  }

  // Fallback when stubs lack dates: re-read frontmatter by slug.
  type Ranked = EssayStub & { pub: number | null };
  const ranked: Ranked[] = essays.map((essay) => {
    const file = listFlatOntologyFilenames().find((f) => {
      const data = readFrontmatterForFilename(f);
      return essaySlugFromFile(f, data) === essay.slug;
    });
    const pub = file ? publicationTimeMs(readFrontmatterForFilename(file)) : null;
    return { ...essay, pub };
  });

  const withResolved = ranked.filter((e) => e.pub != null);
  if (withResolved.length > 0) {
    withResolved.sort((a, b) => b.pub! - a.pub! || a.slug.localeCompare(b.slug));
    return withResolved[0]!.slug;
  }

  const byOrder = [...ranked].sort((a, b) => {
    if (a.order !== b.order) return b.order - a.order;
    return a.slug.localeCompare(b.slug);
  });
  return byOrder[0]!.slug;
}

export interface EssayData {
  frontmatter: Record<string, unknown> & {
    title?: string;
    subtitle?: string;
    image?: string;
    imageAlt?: string;
    lexica?: string[];
    order?: number;
  };
  content: string;
  /**
   * Development only: absolute path of the MD/MDX file the server read.
   * Surfaces `process.cwd()` drift (e.g. dev started from a different clone than Cursor).
   */
  _sourcePath?: string;
}

/** URL-safe slug from filename (strips extension, lowercases, kebab-cases). */
/**
 * Convert a filename or candidate string into a URL-safe slug.
 *
 * Removes md/mdx extensions, unicode diacritics, lowercases and collapses
 * non-alphanumerics to hyphens.
 *
 * @param filename - file basename or slug-like string
 * @returns normalized slug suitable for URLs
 */
export function toSlug(filename: string): string {
  return filename
    .replace(/\.(mdx|md)$/i, "")
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Prefer explicit frontmatter `slug`; fall back to filename (Obsidian-safe). */
function essaySlugFromFile(filename: string, data?: Record<string, unknown>): string {
  if (data && typeof data.slug === "string" && data.slug.trim()) {
    return toSlug(data.slug);
  }
  return toSlug(path.basename(filename));
}

function readFile(fullPath: string): EssayData {
  const raw = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(raw);
  return { frontmatter: data as EssayData["frontmatter"], content };
}

/**
 * Read and normalize the `stage` frontmatter value for a file.
 *
 * Returns a normalized stage string; on error or when missing, returns "draft".
 *
 * @param fullPath - absolute filesystem path to the markdown file
 * @returns normalized stage name (e.g., 'draft', 'review', 'published')
 */
export function readStageFromFile(fullPath: string): string {
  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    const { data } = matter(raw);
    return normalizeStage((data as Record<string, unknown>).stage);
  } catch {
    return "draft";
  }
}

/**
 * Recursively grabs all markdown files within the ONTOLOGY_ROOT directory,
 * preserving forward-slashes for system matching.
 */
function listFlatOntologyFilenames(): string[] {
  const files: string[] = [];
  
  function walk(dir: string, relativeDir = "") {
    if (!fs.existsSync(dir) || !fs.lstatSync(dir).isDirectory()) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const relPath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), relPath);
      } else if (EXTS.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        files.push(relPath.replace(/\\/g, "/"));
      }
    }
  }
  
  walk(ONTOLOGY_ROOT);
  return files;
}

function readFrontmatterForFilename(filename: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(path.join(ONTOLOGY_ROOT, filename), "utf8");
    return matter(raw).data as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Determines if a file belongs to a directory based on its path location on disk. */
function fileBelongsToTopic(filename: string, topicPath: string | string[]): boolean {
  const targetTopicDir = Array.isArray(topicPath) ? topicPath.join("/") : topicPath;
  const cleanTarget = targetTopicDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
  
  const fileDir = path.dirname(filename).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
  
  return fileDir === cleanTarget || (cleanTarget === "me" && fileDir === "me");
}

/**
 * Rank ontology files that share a leaf slug. Prefer essays included in the
 * current publishing tier (so a root draft cannot shadow a published essay),
 * then higher stages, then a stable path order.
 */
function stagePreferenceRank(stage: string): number {
  const s = normalizeStage(stage);
  if (s === "canonical") return 4;
  if (s === "published") return 3;
  if (s === "review") return 2;
  return 1;
}

function pickPreferredOntologyFilename(
  filenames: string[],
  tier: ContentTier = getPublishingContentTier()
): string | null {
  if (filenames.length === 0) return null;
  if (filenames.length === 1) return filenames[0]!;

  const ranked = [...filenames].sort((a, b) => {
    const stageA = readStageFromFile(path.join(ONTOLOGY_ROOT, a));
    const stageB = readStageFromFile(path.join(ONTOLOGY_ROOT, b));
    const inclA = isStageIncludedInBuild(stageA, tier) ? 1 : 0;
    const inclB = isStageIncludedInBuild(stageB, tier) ? 1 : 0;
    if (inclA !== inclB) return inclB - inclA;
    const pref = stagePreferenceRank(stageB) - stagePreferenceRank(stageA);
    if (pref !== 0) return pref;
    return a.localeCompare(b);
  });
  return ranked[0]!;
}

/**
 * Single-file essay lookup. Evaluates exact target files matching the leaf slug name
 * across the recursive folder index tree.
 */
/**
 * Load a single essay by slug (searching frontmatter `slug` or filename).
 *
 * Accepts a slug string or slug path array. When NODE_ENV is development,
 * `_sourcePath` is attached to help surface file-source drift.
 *
 * When multiple files share the same leaf slug (e.g. a root draft and a
 * published essay both set `slug: social-network`), prefer the file included
 * in the current publishing tier so drafts cannot win metadata or legacy routes.
 *
 * @param slugPath - slug string or array of path segments
 * @returns EssayData when found, otherwise null
 */
export function getProfileData(slugPath: string | string[]): EssayData | null {
  const targetSlug = Array.isArray(slugPath) ? slugPath[slugPath.length - 1] : slugPath;
  const cleanTarget = toSlug(targetSlug);

  const matches = listFlatOntologyFilenames().filter((filename) => {
    if (toSlug(path.basename(filename)) === cleanTarget) return true;
    const data = readFrontmatterForFilename(filename);
    return typeof data.slug === "string" && toSlug(data.slug) === cleanTarget;
  });

  const matchedFile = pickPreferredOntologyFilename(matches);

  if (!matchedFile) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[transition-insight] No file found for slug: ${cleanTarget}`);
    }
    return null;
  }

  const found = path.join(ONTOLOGY_ROOT, matchedFile);

  try {
    const essay = readFile(found);
    if (process.env.NODE_ENV === "development") {
      return { ...essay, _sourcePath: found };
    }
    return essay;
  } catch {
    return null;
  }
}

/** Does the given relative path resolve to a topic directory containing valid files? */
/**
 * Determine whether a normalized topic path corresponds to a real folder
 * containing at least one markdown file in the ontology.
 *
 * @param topicPath - folder path as string or array (e.g. ['governance','identity'])
 * @returns true when at least one file is found under the target dir
 */
export function isTopicFolder(topicPath: string | string[]): boolean {
  const targetDir = Array.isArray(topicPath) ? topicPath.join("/") : topicPath;
  const normalizedTarget = targetDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
  
  return listFlatOntologyFilenames().some((filename) => {
    const fileDir = path.dirname(filename).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
    return fileDir === normalizedTarget;
  });
}

/**
 * List essays inside a physical folder directory, sorted by frontmatter `order` (ascending).
 */
/**
 * List essays in a topic folder, sorted by `order` frontmatter ascending.
 *
 * @param topicPath - folder path as string or array
 * @returns array of EssayStub objects (slug, title, order, optional date fields)
 */
export function listEssays(topicPath: string | string[]): EssayStub[] {
  type Enriched = EssayStub & { _filename: string };

  const stubs: Enriched[] = listFlatOntologyFilenames()
    .filter((filename) => fileBelongsToTopic(filename, topicPath))
    .map((filename) => {
      const full = path.join(ONTOLOGY_ROOT, filename);
      let order = Number.POSITIVE_INFINITY;
      let title = path.basename(filename).replace(/\.(mdx|md)$/i, "");
      try {
        const { data } = matter(fs.readFileSync(full, "utf8"));
        if (typeof data.order === "number") order = data.order;
        if (typeof data.title === "string" && data.title.trim()) title = data.title;
      } catch {
        /* fall back to defaults */
      }
      return { slug: toSlug(path.basename(filename)), title, order, _filename: filename };
    });

  stubs.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a._filename.localeCompare(b._filename);
  });

  return stubs.map(({ _filename, ...rest }) => rest);
}

/**
 * Like `listEssays`, but filters content based on the target build tier flags.
 */
/**
 * Like `listEssays` but filters files according to the current build tier.
 *
 * When `tier === 'local'` this is equivalent to listEssays. Otherwise it will
 * exclude essays whose `stage` frontmatter is not included in the target tier.
 *
 * @param topicPath - folder path as string or array
 * @param tier - build tier that controls stage inclusion (defaults to publishing content tier)
 * @returns array of EssayStub objects eligible for the target build
 */
export function listEssaysForBuild(
  topicPath: string | string[],
  tier: ContentTier = getPublishingContentTier()
): EssayStub[] {
  if (tier === "local") return listEssays(topicPath);

  type Enriched = EssayStub & { _filename: string };

  const stubs: (Enriched | null)[] = listFlatOntologyFilenames()
    .filter((filename) => fileBelongsToTopic(filename, topicPath))
    .map((filename) => {
      const full = path.join(ONTOLOGY_ROOT, filename);
      let order = Number.POSITIVE_INFINITY;
      let title = path.basename(filename).replace(/\.(mdx|md)$/i, "");
      const stage = readStageFromFile(full);
      
      if (!isStageIncludedInBuild(stage, tier)) {
        return null;
      }
      try {
        const { data } = matter(fs.readFileSync(full, "utf8"));
        if (typeof data.order === "number") order = data.order;
        if (typeof data.title === "string" && data.title.trim()) title = data.title;
      } catch {
        /* keep defaults */
      }
      return { slug: toSlug(path.basename(filename)), title, order, _filename: filename };
    });

  const filtered = stubs.filter((s): s is Enriched => s != null);

  filtered.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a._filename.localeCompare(b._filename);
  });

  return filtered.map(({ _filename, ...rest }) => rest);
}

/** Read one essay inside a topic by its true directory positioning and URL slug name. */
/**
 * Read a single essay by slug within a topic folder.
 *
 * Ensures the returned essay belongs to the requested topic path. When running
 * in development, `_sourcePath` is attached for debugging file-source drift.
 *
 * When multiple files in the topic share the same slug (e.g. a draft and a
 * published essay), prefer the file included in the current publishing tier —
 * same rule as {@link getProfileData}. A filesystem-first draft must not win
 * and soft-404 published hub leaves via later `stageAllowed` checks.
 *
 * @param topicPath - folder path as string or array
 * @param essaySlug - slug of the essay to find
 * @returns EssayData when found, otherwise null
 */
export function getEssayInTopic(
  topicPath: string | string[],
  essaySlug: string
): EssayData | null {
  const cleanSlug = toSlug(essaySlug);

  const matches = listFlatOntologyFilenames().filter((filename) => {
    const data = readFrontmatterForFilename(filename);
    if (essaySlugFromFile(filename, data) !== cleanSlug) return false;
    return fileBelongsToTopic(filename, topicPath);
  });

  const match = pickPreferredOntologyFilename(matches);
  if (!match) return null;

  try {
    const full = path.join(ONTOLOGY_ROOT, match);
    const essay = readFile(full);
    if (process.env.NODE_ENV === "development") {
      return { ...essay, _sourcePath: full };
    }
    return essay;
  } catch {
    return null;
  }
}

/**
 * Essays in a topic folder, optionally filtered by `series` frontmatter.
 * Excludes `type: series-summary` landers from the nav list.
 */
/**
 * List essays in a physical topic folder, optionally filtered by series.
 *
 * Excludes `type: series-summary` lander files. Returns stubs sorted by `order`.
 *
 * @param topicPath - folder path as string or array
 * @param options - optional filters (e.g., { series: 'peridot' })
 * @returns array of EssayStub
 */
export function listEssaysInTopicFolder(
  topicPath: string | string[],
  options: { series?: string } = {}
): EssayStub[] {
  const seriesTarget = options.series?.trim().toLowerCase();
  const stubs = listFlatOntologyFilenames()
    .filter((filename) => {
      if (!fileBelongsToTopic(filename, topicPath)) return false;
      const data = readFrontmatterForFilename(filename);
      if (data.type === "series-summary") return false;
      if (seriesTarget && !seriesNamesFromFrontmatter(data).includes(seriesTarget)) return false;
      return true;
    })
    .map((filename) => essayStubFromFilename(filename));

  return sortEssayStubs(stubs).map(({ _filename, ...rest }) => rest);
}

/**
 * List essays in a topic folder for a target build tier.
 *
 * Honors `tier` filtering and optional `series` filter. Falls back to the
 * non-filtering `listEssaysInTopicFolder` when the tier is `local` and no
 * series filter was provided.
 *
 * @param topicPath - folder path as string or array
 * @param options - { series?: string, tier?: ContentTier }
 * @returns array of EssayStub eligible for the build
 */
export function listEssaysInTopicFolderForBuild(
  topicPath: string | string[],
  options: { series?: string; tier?: ContentTier } = {}
): EssayStub[] {
  const tier = options.tier ?? getPublishingContentTier();
  const seriesTarget = options.series?.trim().toLowerCase();

  if (tier === "local" && !seriesTarget) {
    return listEssaysInTopicFolder(topicPath, options);
  }

  const stubs = listFlatOntologyFilenames()
    .filter((filename) => {
      if (!fileBelongsToTopic(filename, topicPath)) return false;
      const full = path.join(ONTOLOGY_ROOT, filename);
      if (!isStageIncludedInBuild(readStageFromFile(full), tier)) return false;
      const data = readFrontmatterForFilename(filename);
      if (data.type === "series-summary") return false;
      if (seriesTarget && !seriesNamesFromFrontmatter(data).includes(seriesTarget)) return false;
      return true;
    })
    .map((filename) => essayStubFromFilename(filename));

  return sortEssayStubs(stubs).map(({ _filename, ...rest }) => rest);
}

/** Essays anywhere in the corpus matching a `series` frontmatter value. */
/**
 * Find all essays across the corpus belonging to a named series.
 *
 * Excludes series-summary landers.
 *
 * @param seriesName - series frontmatter value to match (case-insensitive)
 * @returns array of EssayStub
 */
export function listEssaysBySeries(seriesName: string): EssayStub[] {
  const target = seriesName.trim().toLowerCase();
  const stubs = listFlatOntologyFilenames()
    .filter((filename) => {
      const data = readFrontmatterForFilename(filename);
      if (data.type === "series-summary") return false;
      return seriesNamesFromFrontmatter(data).includes(target);
    })
    .map((filename) => essayStubFromFilename(filename));

  return sortEssayStubs(stubs).map(({ _filename, ...rest }) => rest);
}

/**
 * Find essays in a named series respecting build-tier filtering.
 *
 * When `tier === 'local'` this simply delegates to `listEssaysBySeries`.
 *
 * @param seriesName - series frontmatter value to match
 * @param tier - target content tier (defaults to publishing content tier)
 * @returns array of EssayStub eligible for the build
 */
export function listEssaysBySeriesForBuild(
  seriesName: string,
  tier: ContentTier = getPublishingContentTier()
): EssayStub[] {
  if (tier === "local") return listEssaysBySeries(seriesName);

  const target = seriesName.trim().toLowerCase();
  const stubs = listFlatOntologyFilenames()
    .filter((filename) => {
      const full = path.join(ONTOLOGY_ROOT, filename);
      if (!isStageIncludedInBuild(readStageFromFile(full), tier)) return false;
      const data = readFrontmatterForFilename(filename);
      if (data.type === "series-summary") return false;
      return seriesNamesFromFrontmatter(data).includes(target);
    })
    .map((filename) => essayStubFromFilename(filename));

  return sortEssayStubs(stubs).map(({ _filename, ...rest }) => rest);
}

/** Back-compat shim for legacy API calls. */
/**
 * Back-compat shim returning simple { slug, title } pairs for a category.
 *
 * @param category - topic folder path
 * @returns array of lightweight objects with { slug, title }
 */
export function getAllEssaysInCategory(category: string) {
  return listEssays(category).map(({ slug, title }) => ({ slug, title }));
}

/**
 * Resolves a relative ontology path (e.g., 'identity/connexion' or 'me/origins') 
 * to its absolute file path on disk based on physical folders.
 */
/**
 * Resolve a relative ontology path (e.g., 'identity/connexion' or 'me/origins')
 * to an absolute on-disk path for the first matching file.
 *
 * @param relFromOntology - relative ontology path (slashes allowed)
 * @returns absolute filesystem path when found, otherwise null
 */
export function resolveOntologyFilePath(relFromOntology: string): string | null {
  const rel = relFromOntology.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!rel) return null;

  const pathSegments = rel.split("/");
  const targetSlug = pathSegments.pop()!;
  
  const matchedFile = listFlatOntologyFilenames().find((filename) => {
    if (toSlug(path.basename(filename)) !== toSlug(targetSlug)) return false;
    
    if (pathSegments.length > 0) {
      const fileDir = path.dirname(filename).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
      const targetDir = pathSegments.join("/");
      return fileDir === targetDir;
    }
    
    return true;
  });

  return matchedFile ? path.join(ONTOLOGY_ROOT, matchedFile) : null;
}

/** Builds static params loops cleanly walking physical path trees. */
/**
 * Produce static slug params by walking the ontology tree.
 *
 * Returns an array of `{ slug: string[] }` objects suitable for static
 * pre-rendering. Excludes files not included for the current publishing tier.
 *
 * @returns array of slug param objects for SSG
 */
export function listStaticOntologySlugParams(): { slug: string[] }[] {
  const seen = new Set<string>();
  const out: { slug: string[] }[] = [];

  const add = (slug: string[]) => {
    if (slug.length < 2) return;
    const k = slug.join("/");
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ slug });
  };

  for (const filename of listFlatOntologyFilenames()) {
    const fullPath = path.join(ONTOLOGY_ROOT, filename);
    if (!isStageIncludedInBuild(readStageFromFile(fullPath), getPublishingContentTier())) {
      continue;
    }

    const fileSegments = filename.split("/");
    if (fileSegments.length >= 2) {
      const fileSlug = toSlug(fileSegments.pop()!);
      add([...fileSegments, fileSlug]);
      
      add(fileSegments);
    }
  }

  return out;
}