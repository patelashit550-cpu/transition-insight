import { createHash } from "node:crypto";
import { createReadStream, existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

const EXTS = [".md", ".mdx"];

export const ONTOLOGY_ROOT = join(process.cwd(), "ontology");

/** Load `.env.production` / `.env.production.local` without overwriting existing env. */
export function loadProductionEnv() {
  for (const name of [".env.production", ".env.production.local"]) {
    const filePath = join(process.cwd(), name);
    if (!existsSync(filePath)) continue;
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key in process.env) continue;
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
}

loadProductionEnv();

export function getContentBuildTier() {
  const raw = process.env.NEXT_PUBLIC_CONTENT_TIER?.trim()?.toLowerCase();
  if (raw === "local" || raw === "preprod" || raw === "global") return raw;
  if (raw === "dev") return "local";
  if (raw === "prod") return "global";
  if (raw === "staging") return "preprod";
  if (raw === "qa") return "local";
  return process.env.NODE_ENV === "development" ? "local" : "global";
}

export function normalizeStage(raw) {
  if (typeof raw === "string" && raw.trim()) return raw.trim().toLowerCase();
  return "draft";
}

export function isStageIncludedInBuild(stage, tier = getContentBuildTier()) {
  const s = normalizeStage(stage);
  if (tier === "global") return s === "published" || s === "canonical";
  if (tier === "preprod") return s === "review" || s === "published" || s === "canonical";
  return true;
}

export function listOntologyFiles() {
  const files = [];

  function walk(dir, relativeDir = "") {
    if (!existsSync(dir) || !lstatSync(dir).isDirectory()) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const relPath = relativeDir ? join(relativeDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), relPath);
      } else if (EXTS.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        files.push(relPath.replace(/\\/g, "/"));
      }
    }
  }

  walk(ONTOLOGY_ROOT);
  return files.sort((a, b) => a.localeCompare(b));
}

export function sha256File(fullPath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(fullPath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(`sha256:${hash.digest("hex")}`))
      .on("error", reject);
  });
}

export async function sha256FileSync(fullPath) {
  const body = readFileSync(fullPath);
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
}

export function readOntologyEntry(relativePath) {
  const fullPath = join(ONTOLOGY_ROOT, relativePath);
  const raw = readFileSync(fullPath, "utf8");
  const { data } = matter(raw);
  const fm = data ?? {};
  return {
    path: `ontology/${relativePath}`,
    stage: normalizeStage(fm.stage),
    title: typeof fm.title === "string" ? fm.title : null,
    author: typeof fm.author === "string" ? fm.author : null,
    publishedAt: fm.publishedAt ?? null,
    slug: typeof fm.slug === "string" ? fm.slug : null,
    series: fm.series ?? null,
  };
}

export function manifestDigestFromEntries(entries) {
  const lines = entries
    .map((entry) => `${entry.path}\t${entry.sha256}`)
    .sort((a, b) => a.localeCompare(b));
  return `sha256:${createHash("sha256").update(lines.join("\n"), "utf8").digest("hex")}`;
}

export function getSovereignEnv() {
  const sns = process.env.NEXT_PUBLIC_SNS_DOMAIN?.trim() || null;
  const solSite =
    process.env.NEXT_PUBLIC_SOL_SITE_URL?.trim() ||
    (sns ? `https://${sns.replace(/\.sol$/i, "")}.sol.sites` : null);
  const solana = process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS?.trim() || null;
  const canonical = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ashitmilne.xyz";

  return {
    canonical,
    sns,
    solSite,
    ens: process.env.NEXT_PUBLIC_ENS_DOMAIN?.trim() || null,
    solana,
    did: solana ? `did:pkh:solana:${solana}` : null,
  };
}

/** Domain-separated message bytes for Ed25519 attestation signatures. */
export function attestationSignPayload(manifestDigest, generated, tier) {
  return Buffer.from(
    `transition-insight:attestation:v1:${tier}:${generated}:${manifestDigest}`,
    "utf8",
  );
}
