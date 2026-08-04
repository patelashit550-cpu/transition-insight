#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { walkFiles } from "./lib/walk-files.mjs";

const outDir = join(process.cwd(), "out");
const files = walkFiles(outDir).filter(({ relativePath }) =>
  /\.(html|js|css|json|txt|xml|webmanifest)$/.test(relativePath),
);

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

let patched = 0;

for (const file of files) {
  const prefix = relRoot(file.relativePath);
  let text = readFileSync(file.absolutePath, "utf8");
  let changed = false;

  for (const root of rootPrefixes) {
    const tail = root.slice(1); // drop leading /
    const to = `"${prefix}${tail}`;
    const toSingle = `'${prefix}${tail}`;

    for (const from of [`"${root}`, `'${root}`]) {
      if (text.includes(from)) {
        text = text.split(from).join(from.startsWith('"') ? to : toSingle);
        changed = true;
      }
    }
  }

  if (changed) {
    writeFileSync(file.absolutePath, text, "utf8");
    patched++;
  }
}

console.log(`ipfs-relative-export: patched ${patched} file(s) in out/`);
