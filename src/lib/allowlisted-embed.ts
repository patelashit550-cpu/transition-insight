/**
 * Allowlisted media embeds for reading pages.
 *
 * ReactMarkdown does not render raw HTML (no rehype-raw), so ontology
 * `<iframe>` tags are otherwise stripped. Spotify is driven from
 * frontmatter; this module also validates iframe `src` values that a
 * remark plugin may lift out of markdown (YouTube + Spotify).
 */

const SPOTIFY_EMBED_HOSTS = new Set(["open.spotify.com"]);
const YOUTUBE_EMBED_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
]);

/** Spotify playlist IDs are base62; live IDs are typically 22 chars. */
const SPOTIFY_PLAYLIST_ID = /^[A-Za-z0-9]{10,32}$/;

export type AllowlistedEmbedKind = "spotify" | "youtube";

export type AllowlistedIframe = {
  src: string;
  kind: AllowlistedEmbedKind;
  title: string;
  allow: string;
  height: number;
};

const SPOTIFY_ALLOW =
  "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
const YOUTUBE_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

function decodeHtmlAttr(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseHtmlAttrs(attrChunk: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attrChunk))) {
    const key = match[1]?.toLowerCase();
    if (!key) continue;
    out[key] = decodeHtmlAttr(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return out;
}

/** Parse a standalone `<iframe …>` / `<iframe …/>` HTML snippet. */
export function parseIframeTag(html: string): Record<string, string> | null {
  const trimmed = html.trim();
  const paired = trimmed.match(/^<iframe\b([^>]*)>(?:\s*<\/iframe>)?\s*$/i);
  if (paired) return parseHtmlAttrs(paired[1] ?? "");
  const selfClosing = trimmed.match(/^<iframe\b([^>]*)\/>\s*$/i);
  if (selfClosing) return parseHtmlAttrs(selfClosing[1] ?? "");
  return null;
}

export function parseSpotifyPlaylistId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  const fromUrl = value.match(
    /open\.spotify\.com\/(?:embed\/)?playlist\/([A-Za-z0-9]+)/i
  );
  if (fromUrl?.[1] && SPOTIFY_PLAYLIST_ID.test(fromUrl[1])) return fromUrl[1];
  if (SPOTIFY_PLAYLIST_ID.test(value)) return value;
  return null;
}

export function spotifyPlaylistEmbedSrc(playlistId: string): string {
  return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator`;
}

function classifyEmbedSrc(src: string): AllowlistedEmbedKind | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (SPOTIFY_EMBED_HOSTS.has(url.hostname) && url.pathname.startsWith("/embed/")) {
    return "spotify";
  }
  if (YOUTUBE_EMBED_HOSTS.has(url.hostname) && url.pathname.startsWith("/embed/")) {
    return "youtube";
  }
  return null;
}

/**
 * Return a canonical https embed URL when `src` is an allowlisted player.
 * Rejects javascript:, data:, and off-origin frames.
 */
export function allowlistedIframeSrc(src: string): string | null {
  return classifyEmbedSrc(src) ? src : null;
}

export function allowlistedIframeFromSrc(
  src: string,
  title?: string
): AllowlistedIframe | null {
  const kind = classifyEmbedSrc(src);
  if (!kind) return null;
  if (kind === "spotify") {
    return {
      src,
      kind,
      title: title?.trim() || "Spotify playlist",
      allow: SPOTIFY_ALLOW,
      height: 352,
    };
  }
  return {
    src,
    kind,
    title: title?.trim() || "Embedded video",
    allow: YOUTUBE_ALLOW,
    height: 315,
  };
}

export function allowlistedIframeFromHtml(html: string): AllowlistedIframe | null {
  const attrs = parseIframeTag(html);
  if (!attrs?.src) return null;
  return allowlistedIframeFromSrc(attrs.src, attrs.title);
}
