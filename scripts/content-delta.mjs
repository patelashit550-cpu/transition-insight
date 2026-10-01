#!/usr/bin/env node
/**
 * List every changed / new / deleted markdown file and what it does to the public site.
 *
 *   npm run delta
 *
 * Exits 1 if any changed content file has unparseable frontmatter.
 */
import { formatDelta, listMarkdownDelta } from "./lib/md-delta.mjs";

const entries = listMarkdownDelta();
console.log(formatDelta(entries));
if (entries.some((e) => e.error)) process.exit(1);
