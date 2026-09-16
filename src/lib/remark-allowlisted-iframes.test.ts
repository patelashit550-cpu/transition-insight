import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";

import { remarkAllowlistedIframes } from "./remark-allowlisted-iframes.ts";

function render(md: string): string {
  return renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkAllowlistedIframes],
        components: {
          iframe: ({ src, title, className, allow, height }) =>
            React.createElement("iframe", {
              src,
              title,
              className,
              allow,
              height,
            }),
        },
      },
      md
    )
  );
}

test("allowlisted Spotify iframe HTML renders as an iframe", () => {
  const html = render(
    `<iframe src="https://open.spotify.com/embed/playlist/3KCcNodoGPZckuspVql8vm" title="3 AM Eternal"></iframe>`
  );
  assert.match(html, /<iframe/);
  assert.match(html, /open\.spotify\.com\/embed\/playlist\/3KCcNodoGPZckuspVql8vm/);
  assert.doesNotMatch(html, /&lt;iframe/);
});

test("allowlisted YouTube iframe HTML renders as an iframe", () => {
  const html = render(
    `<iframe class="VideoIframe__iframe___2ebvN" src="https://www.youtube.com/embed/CZIINXhGDcs" title="Embedded Video"></iframe>`
  );
  assert.match(html, /<iframe/);
  assert.match(html, /www\.youtube\.com\/embed\/CZIINXhGDcs/);
});

test("off-origin iframe HTML is stripped, not rendered", () => {
  const html = render(`<iframe src="https://evil.example/embed/x"></iframe>`);
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, /evil\.example/);
});
