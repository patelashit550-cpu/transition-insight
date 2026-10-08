#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { walkFiles } from "./lib/walk-files.mjs";

const outDir = join(process.cwd(), "out");
if (!existsSync(outDir)) {
  console.error("ipfs-relative-export: out/ missing — run npm run build:global first");
  process.exit(1);
}
/**
 * React Flight payload files the App Router fetches on navigation/hydration
 * (`index.txt`, `__next.*.txt`). Like inline flight scripts, their chunk
 * references must stay root-absolute or the client runtime 404s chunks.
 *
 * @param {string} normalizedPath
 */
function isFlightPayload(normalizedPath) {
  const name = normalizedPath.split("/").pop() ?? "";
  return name === "index.txt" || name.startsWith("__next.");
}

const files = walkFiles(outDir).filter(({ relativePath }) => {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  return (
    /\.(html|js|css|json|txt|xml|webmanifest)$/.test(normalizedPath) &&
    !normalizedPath.startsWith("_next/") &&
    !isFlightPayload(normalizedPath)
  );
});

const rootPrefixes = ["/_next/", "/visuals/", "/assets/", "/.well-known/", "/manifest.webmanifest"];

/** @param {string} relativePath */
function relRoot(relativePath) {
  // Drop the filename, then count remaining path segments.
  // (Replacing /file only fails for root files like `index.html` — no slash —
  // and wrongly yielded depth 1 → `../` which escapes the CID on path gateways.)
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  parts.pop();
  const dirDepth = parts.length;
  return dirDepth === 0 ? "./" : `${"../".repeat(dirDepth)}`;
}

/**
 * Keep <script> elements byte-for-byte intact: both inline React Flight
 * records and the `src` of the runtime chunk tags. They carry Turbopack chunk
 * identifiers (`/_next/static/chunks/…`), not plain browser URLs; rewriting
 * either side (e.g. to `./_next/…`) stops the client runtime matching
 * registered chunks and leaves hydration silently suspended, so client
 * components (compass watermark reveal, equal-height bento rows) never run.
 *
 * @param {string} html
 * @param {(text: string) => string} rewrite
 */
function rewriteHtmlOutsideScriptBodies(html, rewrite) {
  const scriptPattern = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
  let result = "";
  let previousEnd = 0;

  for (const match of html.matchAll(scriptPattern)) {
    const matchStart = match.index;
    const script = match[0];
    result += rewrite(html.slice(previousEnd, matchStart));
    result += script;
    previousEnd = matchStart + script.length;
  }

  return result + rewrite(html.slice(previousEnd));
}

let patched = 0;

for (const file of files) {
  const prefix = relRoot(file.relativePath);
  let text = readFileSync(file.absolutePath, "utf8");
  const rewrite = (source) => {
    let rewritten = source;

    for (const root of rootPrefixes) {
      const tail = root.slice(1); // drop leading /
      const to = `"${prefix}${tail}`;
      const toSingle = `'${prefix}${tail}`;

      for (const from of [`"${root}`, `'${root}`]) {
        if (rewritten.includes(from)) {
          rewritten = rewritten.split(from).join(from.startsWith('"') ? to : toSingle);
        }
      }
    }

    return rewritten;
  };
  const rewritten = file.relativePath.toLowerCase().endsWith(".html")
    ? rewriteHtmlOutsideScriptBodies(text, rewrite)
    : rewrite(text);

  if (rewritten !== text) {
    writeFileSync(file.absolutePath, rewritten, "utf8");
    patched++;
  }
}

console.log(`ipfs-relative-export: patched ${patched} file(s) in out/`);
