/**
 * Probe the Colosseum Copilot API base.
 *
 * Usage:
 *   npm run copilot:status
 *
 * Public base is COLOSSEUM_COPILOT_API_BASE (default copilot.colosseum.com/api/v1).
 * PAT stays in .env.local (gitignored). Connexion is unchanged.
 */
import { loadEnvFiles } from "./lib/load-env.mjs";
import {
  COLOSSEUM_COPILOT_TOKEN_URL,
  configuredCopilotApiBase,
  copilotPatFromEnv,
  probeCopilotStatus,
} from "../src/lib/colosseum-copilot.ts";

loadEnvFiles();

const apiBase = configuredCopilotApiBase();
const pat = copilotPatFromEnv();

const result = await probeCopilotStatus({ apiBase, pat });

const out: Record<string, unknown> = {
  apiBase,
  statusUrl: result.url,
  authenticated: result.ok ? result.status.authenticated : false,
  httpStatus: result.ok ? 200 : (result.httpStatus ?? null),
  error: result.ok ? null : result.error,
};

if (result.ok) {
  out.expiresAt = result.status.expiresAt;
  out.scope = result.status.scope;
}

if (!pat) {
  out.pat = {
    configured: false,
    hint: `export COLOSSEUM_COPILOT_PAT from ${COLOSSEUM_COPILOT_TOKEN_URL} into .env.local`,
  };
} else {
  out.pat = { configured: true };
}

console.log(JSON.stringify(out, null, 2));

if (!pat) {
  process.exit(2);
}
if (!result.ok) {
  process.exit(1);
}
