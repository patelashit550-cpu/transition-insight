#!/usr/bin/env node
/**
 * Fail if published essays changed since the last Canonical refresh.
 *
 *   npm run canon:check
 *   npm run ship                 # runs this first
 *   npm run ship -- --skip-canon # bypass
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

import { isStageIncludedInBuild, normalizeStage } from "./lib/content-provenance.mjs";
import { walkFiles } from "./lib/walk-files.mjs";

const ROOT = process.cwd();
const ONTOLOGY = join(ROOT, "ontology");
const META_PATH = join(ROOT, "scripts", "data", "canon-generated.json");

const EXCLUDE = new Set([
  "lexica.md",
  "canonical.md",
  "canon.md",
  "governance/canon.md",
  "governance/canonical.md",
  "governance/canon.legacy.md",
]);

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function listPublishedPaths() {
  return walkFiles(ONTOLOGY)
    .filter(({ relativePath }) => /\.(md|mdx)$/i.test(relativePath))
    .filter(({ relativePath }) => {
      const n = normalizePath(relativePath).toLowerCase();
      return (
        !EXCLUDE.has(n) &&
        !n.endsWith("/canon.md") &&
        !n.endsWith("/canonical.md") &&
        !n.endsWith("/canon.legacy.md")
      );
    })
    .map(({ relativePath, absolutePath }) => {
      const stage = normalizeStage(matter(readFileSync(absolutePath, "utf8")).data.stage);
      if (!isStageIncludedInBuild(stage, "global")) return null;
      return normalizePath(relativePath);
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

const published = listPublishedPaths();

if (!existsSync(META_PATH)) {
  console.error("canon:check FAIL — missing scripts/data/canon-generated.json");
  console.error("Fix: npm run canon:generate");
  process.exit(1);
}

const meta = JSON.parse(readFileSync(META_PATH, "utf8"));
const stamped = Array.isArray(meta.essays) ? [...meta.essays].map(normalizePath).sort() : [];

const publishedSet = new Set(published);
const stampedSet = new Set(stamped);
const added = published.filter((p) => !stampedSet.has(p));
const removed = stamped.filter((p) => !publishedSet.has(p));

if (!added.length && !removed.length) {
  console.log(
    `canon:check ok — ${published.length} published essays (stamped ${meta.generatedAt || "unknown"})`
  );
  process.exit(0);
}

console.error("canon:check FAIL — published essays changed since last stamp.");
if (added.length) console.error(`  new: ${added.join(", ")}`);
if (removed.length) console.error(`  removed: ${removed.join(", ")}`);
console.error("Fix: npm run canon:generate   (ship runs this automatically)");
process.exit(1);
