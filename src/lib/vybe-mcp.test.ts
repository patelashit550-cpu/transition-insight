import assert from "node:assert/strict";
import { test } from "node:test";

import { VYBE_API_KEY_ENV, vybeApiKeyFromEnv } from "./vybe-mcp.ts";

test("vybeApiKeyFromEnv rejects missing and placeholder keys", () => {
  assert.equal(vybeApiKeyFromEnv({}), null);
  assert.equal(vybeApiKeyFromEnv({ [VYBE_API_KEY_ENV]: "YOUR_API_KEY" }), null);
  assert.equal(vybeApiKeyFromEnv({ [VYBE_API_KEY_ENV]: "your-api-key" }), null);
  assert.equal(vybeApiKeyFromEnv({ [VYBE_API_KEY_ENV]: "  " }), null);
  assert.equal(vybeApiKeyFromEnv({ [VYBE_API_KEY_ENV]: "live-vybe-key" }), "live-vybe-key");
});
