import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/globals.css"),
  "utf8",
);

test("essay subtitles left-align the header and emerald rule without a plate split", () => {
  assert.match(
    css,
    /\.p3-narrative-article__header:has\(\.p3-topic-article__subtitle\)\s*\{[^}]*text-align:\s*left/s,
  );
  assert.match(
    css,
    /\.p3-narrative-article__header:has\(\.p3-topic-article__subtitle\)\s+\.p3-narrative-article__rule\s*\{[^}]*margin-left:\s*0/s,
  );
});

test("essay subtitle kicker is readable gray-white, not dim zinc-500", () => {
  assert.match(css, /--p3-essay-subtitle-color:\s*#d4d4d8/);
  const subtitleBlock = css.match(/\.p3-topic-article__subtitle\s*\{[^}]+\}/);
  assert.ok(subtitleBlock, "expected .p3-topic-article__subtitle rule");
  assert.doesNotMatch(subtitleBlock[0], /#71717a/);
  assert.match(subtitleBlock[0], /color:\s*var\(--p3-essay-subtitle-color\)/);
  assert.match(subtitleBlock[0], /text-align:\s*left/);
});
