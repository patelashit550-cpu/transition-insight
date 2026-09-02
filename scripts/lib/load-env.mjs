import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load env files in order; later files override earlier file keys.
 * Never clobber a variable already present on `process.env` (shell / parent
 * process wins) so `SOLANA_KEYPAIR_PATH` set for `ship` / `content:sign` is
 * not replaced by an empty or stale `.env.local` entry.
 */
export function loadEnvFiles(root = process.cwd()) {
  /** @type {Record<string, string>} */
  const fromFiles = {};
  for (const name of [".env.production", ".env.development", ".env", ".env.local", ".env.production.local"]) {
    const filePath = join(root, name);
    if (!existsSync(filePath)) continue;
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      fromFiles[key] = value;
    }
  }
  for (const [key, value] of Object.entries(fromFiles)) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    process.env[key] = value;
  }
}
