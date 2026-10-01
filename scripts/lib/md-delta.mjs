/**
 * Markdown delta: every changed / new / deleted `.md` / `.mdx` in the working tree
 * (vs HEAD), classified by its effect on the public (global-tier) site.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

import { isStageIncludedInBuild, normalizeStage } from "./content-provenance.mjs";
import { runSync } from "./run-cmd.mjs";

/** Never committed or deployed by `ship` (review-tier glossary, local tool logs). */
export const SHIP_EXCLUDE = [
  "ontology/governance/Canonical-Review.md",
  ".aider.chat.history.md",
];

const CONTENT_ROOT = "ontology/";

/**
 * Parse `git status --porcelain=v1 -z` output. Renames/copies carry the original
 * path as the following NUL-separated field, which is skipped.
 * @param {string} stdout
 * @returns {{ code: string, path: string }[]}
 */
export function parsePorcelainZ(stdout) {
  const fields = stdout.split("\0").filter(Boolean);
  const rows = [];
  for (let i = 0; i < fields.length; i++) {
    const code = fields[i].slice(0, 2);
    rows.push({ code, path: fields[i].slice(3) });
    if (code[0] === "R" || code[0] === "C") i++;
  }
  return rows;
}

/** @param {string} code */
export function statusOf(code) {
  if (code === "??") return "new";
  if (code.includes("D")) return "deleted";
  if (code.includes("R")) return "renamed";
  return "modified";
}

/**
 * Effect of one entry on the public site.
 * @param {{ kind: string, status: string, live?: boolean | null, wasLive?: boolean | null, error?: string }} entry
 */
export function effectOf(entry) {
  if (entry.kind === "excluded") return "excluded";
  if (entry.kind === "docs") return "docs";
  if (entry.error) return "frontmatter error";
  if (entry.status === "deleted") return entry.wasLive ? "removed (was live)" : "removed";
  if (entry.live && !entry.wasLive) return "publish";
  if (!entry.live && entry.wasLive) return "unpublish";
  return entry.live ? "live update" : "draft";
}

function readStage(text) {
  return normalizeStage(matter(text).data.stage);
}

function stageAtHead(root, path) {
  const r = runSync("git", ["show", `HEAD:${path}`], { cwd: root, stdio: "pipe" });
  if (r.status !== 0) return null;
  try {
    return readStage(r.stdout);
  } catch {
    return null;
  }
}

function classify(root, { code, path }) {
  const status = statusOf(code);
  if (SHIP_EXCLUDE.includes(path)) return { path, status, kind: "excluded" };
  if (!path.startsWith(CONTENT_ROOT)) return { path, status, kind: "docs" };

  const prevStage = status === "new" ? null : stageAtHead(root, path);
  const wasLive = prevStage ? isStageIncludedInBuild(prevStage, "global") : false;
  if (status === "deleted") {
    return { path, status, kind: "content", stage: null, prevStage, live: false, wasLive };
  }
  try {
    const stage = readStage(readFileSync(join(root, path), "utf8"));
    return {
      path,
      status,
      kind: "content",
      stage,
      prevStage,
      live: isStageIncludedInBuild(stage, "global"),
      wasLive,
    };
  } catch (error) {
    return {
      path,
      status,
      kind: "content",
      stage: null,
      prevStage,
      live: false,
      wasLive,
      error: error instanceof Error ? error.message.split("\n")[0] : String(error),
    };
  }
}

/** @param {string} [root] */
export function listMarkdownDelta(root = process.cwd()) {
  const r = runSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "*.md", "*.mdx"],
    { cwd: root, stdio: "pipe" },
  );
  if (r.status !== 0) throw new Error(`md-delta: git status failed — ${r.stderr?.trim()}`);
  return parsePorcelainZ(r.stdout)
    .map((row) => classify(root, row))
    .map((entry) => ({ ...entry, effect: effectOf(entry) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Paths `ship` should stage: everything in the delta except excluded files. */
export function shippablePaths(entries) {
  return entries.filter((e) => e.kind !== "excluded").map((e) => e.path);
}

const STATUS_MARK = { new: "A", modified: "M", deleted: "D", renamed: "R" };

export function formatDelta(entries) {
  if (!entries.length) return "markdown delta: no changed .md / .mdx files";
  const width = Math.max(...entries.map((e) => e.path.length));
  const lines = entries.map((e) => {
    const stage = e.kind === "content" && e.stage ? `  [${e.prevStage && e.prevStage !== e.stage ? `${e.prevStage} → ` : ""}${e.stage}]` : "";
    const err = e.error ? `  — ${e.error}` : "";
    return `  ${STATUS_MARK[e.status]}  ${e.path.padEnd(width)}  ${e.effect}${stage}${err}`;
  });
  const live = entries.filter((e) => ["publish", "live update", "unpublish", "removed (was live)"].includes(e.effect)).length;
  return [`markdown delta: ${entries.length} file(s), ${live} affecting the public site`, ...lines].join("\n");
}
