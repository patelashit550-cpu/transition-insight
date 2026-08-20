/**
 * Serialize a JSON-LD object for embedding in `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is not HTML-safe: a frontmatter string containing
 * `</script>` (any casing) terminates the script element and can break the
 * page or enable XSS when injected via `dangerouslySetInnerHTML`.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
