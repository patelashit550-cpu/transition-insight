import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeOntologyFileBytes,
  sha256OntologyFileBytes,
} from "./content-provenance.mjs";

test("normalizeOntologyFileBytes maps CRLF to LF", () => {
  const crlf = Buffer.from("line one\r\nline two\r\n", "utf8");
  const lf = Buffer.from("line one\nline two\n", "utf8");
  assert.deepEqual(normalizeOntologyFileBytes(crlf), lf);
});

test("sha256OntologyFileBytes matches across CRLF and LF", () => {
  const crlf = Buffer.from("# Title\r\n\r\nBody.\r\n", "utf8");
  const lf = Buffer.from("# Title\n\nBody.\n", "utf8");
  assert.equal(sha256OntologyFileBytes(crlf), sha256OntologyFileBytes(lf));
});
