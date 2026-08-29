#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { walkFiles } from "./lib/walk-files.mjs";

const outDir = join(process.cwd(), "out");
if (!existsSync(outDir)) {
  console.error("ipfs-relative-export: out/ missing — run npm run build:global first");
  process.exit(1);
}
const files = walkFiles(outDir).filter(({ relativePath }) => {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  return (
    /\.(html|js|css|json|txt|xml|webmanifest)$/.test(normalizedPath) &&
    !normalizedPath.startsWith("_next/")
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
 * Keep React Flight payloads byte-for-byte intact. Their inline script records
 * contain Turbopack chunk identifiers, not browser URLs; rewriting those
 * identifiers prevents the client runtime from matching registered chunks and
 * leaves hydration suspended.
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
    const openingTagEnd = script.indexOf(">") + 1;
    result += rewrite(html.slice(previousEnd, matchStart));
    result += rewrite(script.slice(0, openingTagEnd));
    result += script.slice(openingTagEnd);
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
