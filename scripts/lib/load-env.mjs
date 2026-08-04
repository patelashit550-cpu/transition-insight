import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Load env files in order; later files override earlier keys. */
export function loadEnvFiles(root = process.cwd()) {
  for (const name of [".env.production", ".env", ".env.local", ".env.production.local"]) {
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
      process.env[key] = value;
    }
  }
}
