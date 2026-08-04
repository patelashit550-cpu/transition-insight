import fs from "fs";
import path from "path";
import matter from "gray-matter";

import {
  getContentBuildTier,
  isStageIncludedInBuild,
  normalizeStage,
  type ContentTier,
} from "@/lib/content-tier";
import { ONTOLOGY_ROOT } from "@/lib/content-paths";

const STAGE_LABELS: Record<string, string> = {
  draft: "Writing",
  review: "Editing",
  published: "Published",
  canonical: "Canonical",
};

export type WorkflowRow = {
  slug: string;
  title: string;
  stage: string;
  lane: string;
  showInNav: boolean;
  /** Preprod static build: `review` + published tiers (not `draft`). */
  visibleInPreprod: boolean;
  /** Production export: `published` / `canonical` only). */
  visibleInGlobal: boolean;
};

function listMdFiles(dir: string): string[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs.readdirSync(dir).filter((name) => /\.(md|mdx)$/i.test(name));
}

function collectFiles(relDir: string, out: string[]): void {
  const absDir = path.join(ONTOLOGY_ROOT, relDir);
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) return;

  const files = listMdFiles(absDir);
  for (const file of files) {
    out.push(path.join(absDir, file));
  }

  for (const ent of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    collectFiles(path.join(relDir, ent.name), out);
  }
}

function toSlug(fullPath: string): string {
  const rel = path.relative(ONTOLOGY_ROOT, fullPath).replace(/\\/g, "/");
  return rel.replace(/\.(md|mdx)$/i, "");
}

function fallbackTitleFromSlug(slug: string): string {
  const leaf = slug.split("/").pop() ?? slug;
  return leaf
    .split(/[-_]/g)
    .filter(Boolean)
    .map((s) => s[0]?.toUpperCase() + s.slice(1))
    .join(" ");
}

export function listPublishingWorkflowRows(): WorkflowRow[] {
  const files: string[] = [];
  collectFiles("", files);

  const rows: WorkflowRow[] = files.map((fullPath) => {
    const raw = fs.readFileSync(fullPath, "utf8");
    const { data } = matter(raw);
    const frontmatter = data as Record<string, unknown>;
    const stage = normalizeStage(frontmatter.stage);
    const slug = toSlug(fullPath);
    const title =
      typeof frontmatter.title === "string" && frontmatter.title.trim()
        ? frontmatter.title.trim()
        : fallbackTitleFromSlug(slug);
    const showInNav = frontmatter.showInNav === true;

    return {
      slug,
      title,
      stage,
      lane: STAGE_LABELS[stage] ?? "Writing",
      showInNav,
      visibleInPreprod: isStageIncludedInBuild(stage, "preprod"),
      visibleInGlobal: isStageIncludedInBuild(stage, "global"),
    };
  });

  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows;
}

export function getWorkflowCounts(rows: WorkflowRow[]) {
  const counts = {
    writing: 0,
    editing: 0,
    published: 0,
    canonical: 0,
  };

  for (const row of rows) {
    if (row.stage === "draft") counts.writing += 1;
    else if (row.stage === "review") counts.editing += 1;
    else if (row.stage === "published") counts.published += 1;
    else if (row.stage === "canonical") counts.canonical += 1;
  }

  return counts;
}

export function getWorkflowContext() {
  const tier = getContentBuildTier();
  const rows = listPublishingWorkflowRows();
  const counts = getWorkflowCounts(rows);
  return { tier, rows, counts };
}

export function tierLabel(tier: ContentTier): string {
  if (tier === "local") return "LOCAL";
  if (tier === "preprod") return "PREPROD";
  return "GLOBAL";
}
