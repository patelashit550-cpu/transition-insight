import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Load env files in order; later files override earlier keys. */
export function loadEnvFiles(root = process.cwd()) {
  for (const name of [".env.production", ".env.development", ".env", ".env.local", ".env.production.local"]) {
    const filePath = join(root, name);
    if (!existsSync(filePath)) continue;
    let text = readFileSync(filePath, "utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed
        .slice(0, eq)
        .trim()
        .replace(/^export\s+/i, "");
      let value = trimmed.slice(eq + 1).trim().replace(/\r$/, "");
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}
