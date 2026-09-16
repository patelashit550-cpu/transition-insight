import assert from "node:assert/strict";
import { test } from "node:test";

import {
  allowlistedIframeFromHtml,
  allowlistedIframeSrc,
  parseSpotifyPlaylistId,
  spotifyPlaylistEmbedSrc,
} from "./allowlisted-embed.ts";

const PLAYLIST_ID = "3KCcNodoGPZckuspVql8vm";

test("parseSpotifyPlaylistId accepts a bare playlist id", () => {
  assert.equal(parseSpotifyPlaylistId(PLAYLIST_ID), PLAYLIST_ID);
});

test("parseSpotifyPlaylistId accepts open.spotify.com playlist and embed URLs", () => {
  assert.equal(
    parseSpotifyPlaylistId(`https://open.spotify.com/playlist/${PLAYLIST_ID}`),
    PLAYLIST_ID
  );
  assert.equal(
    parseSpotifyPlaylistId(
      `https://open.spotify.com/embed/playlist/${PLAYLIST_ID}?utm_source=generator`
    ),
    PLAYLIST_ID
  );
});

test("parseSpotifyPlaylistId rejects empty and non-id values", () => {
  assert.equal(parseSpotifyPlaylistId(""), null);
  assert.equal(parseSpotifyPlaylistId("not a playlist"), null);
  assert.equal(parseSpotifyPlaylistId("https://evil.example/playlist/abc"), null);
});

test("spotifyPlaylistEmbedSrc is https open.spotify.com /embed/playlist", () => {
  const src = spotifyPlaylistEmbedSrc(PLAYLIST_ID);
  assert.equal(
    src,
    `https://open.spotify.com/embed/playlist/${PLAYLIST_ID}?utm_source=generator`
  );
});

test("allowlistedIframeSrc permits Spotify and YouTube embed origins only", () => {
  assert.ok(
    allowlistedIframeSrc(`https://open.spotify.com/embed/playlist/${PLAYLIST_ID}`)
  );
  assert.ok(allowlistedIframeSrc("https://www.youtube.com/embed/CZIINXhGDcs"));
  assert.ok(allowlistedIframeSrc("https://www.youtube-nocookie.com/embed/CZIINXhGDcs"));
  assert.equal(allowlistedIframeSrc("https://evil.example/embed/x"), null);
  assert.equal(allowlistedIframeSrc("javascript:alert(1)"), null);
  assert.equal(allowlistedIframeSrc("https://open.spotify.com/playlist/x"), null);
});

test("allowlistedIframeFromHtml reads a Spotify generator iframe", () => {
  const html = `<iframe style="border-radius:12px" src="https://open.spotify.com/embed/playlist/${PLAYLIST_ID}?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
  const embed = allowlistedIframeFromHtml(html);
  assert.ok(embed);
  assert.equal(embed.kind, "spotify");
  assert.match(embed.src, /open\.spotify\.com\/embed\/playlist/);
});

test("allowlistedIframeFromHtml reads a YouTube VideoIframe snippet", () => {
  const html =
    '<iframe class="VideoIframe__iframe___2ebvN" src="https://www.youtube.com/embed/CZIINXhGDcs" frameborder="0" allowfullscreen="" title="Embedded Video"></iframe>';
  const embed = allowlistedIframeFromHtml(html);
  assert.ok(embed);
  assert.equal(embed.kind, "youtube");
  const parsed = new URL(embed.src);
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.hostname, "www.youtube.com");
  assert.equal(parsed.pathname, "/embed/CZIINXhGDcs");
});

test("allowlistedIframeFromHtml still allowlists YouTube src with entity-encoded query", () => {
  const html =
    '<iframe src="https://www.youtube.com/embed/7QU1nvuxaMA?list=RD7QU1nvuxaMA&amp;start_radio=1" title="Embedded Video"></iframe>';
  const embed = allowlistedIframeFromHtml(html);
  assert.ok(embed);
  assert.equal(embed.kind, "youtube");
  const parsed = new URL(embed.src);
  assert.equal(parsed.hostname, "www.youtube.com");
  assert.equal(parsed.pathname, "/embed/7QU1nvuxaMA");
});
