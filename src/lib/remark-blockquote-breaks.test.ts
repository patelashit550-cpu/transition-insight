import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";

import { remarkBlockquoteBreaks } from "./remark-blockquote-breaks.ts";

function render(md: string): string {
  return renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkBlockquoteBreaks] }, md)
  );
}

test("blockquote verse lines render as hard breaks", () => {
  const html = render(`> I am the son and the heir
> Of a shyness that is criminally vulgar
> I am the son and heir
> Of nothing in particular
> 
> ~ The Smiths (How Soon is Now)`);

  assert.match(html, /<blockquote>/);
  assert.match(html, /I am the son and the heir<br\/?>/);
  assert.match(html, /Of nothing in particular<\/p>\s*<p>~ The Smiths/);
  assert.equal((html.match(/<blockquote>/g) ?? []).length, 1);
});

test("prose soft wraps stay a single flowing line", () => {
  const html = render(`In 2000 we moved into our home in Acton,
Northwest of Toronto.`);

  assert.doesNotMatch(html, /<br\/?>/);
  assert.match(html, /Acton,\s*Northwest of Toronto/);
});
