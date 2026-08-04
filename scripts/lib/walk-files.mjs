import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** @returns {{ relativePath: string, absolutePath: string }[]} */
export function walkFiles(dir, base = dir, files = []) {
  for (const name of readdirSync(dir)) {
    const absolutePath = join(dir, name);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      walkFiles(absolutePath, base, files);
    } else if (stat.isFile()) {
      files.push({
        relativePath: relative(base, absolutePath).replace(/\\/g, "/"),
        absolutePath,
      });
    }
  }
  return files;
}
