import path from "path";

/** Flat markdown corpus at repo root (`ontology/*.md`, `ontology/*.mdx`). */
export const ONTOLOGY_ROOT = path.join(process.cwd(), "ontology");

/**
 * Topic routes (`/transition-insight/<top>/<topic>/…`) → normalized `series` frontmatter slugs.
 * Compared with {@link import("@/lib/markdown").toSlug toSlug}(`series`).
 */
export const ONTOLOGY_TOPIC_KEYS: Record<string, readonly string[]> = {
  "governance/identity": ["dial-square"],
  "governance/capital": ["e-pluribus-unum"],
  "governance/intelligence": ["sine-qua-non"],
  "governance/illumination": ["peridot"],
  "chronicle/imprimatur": ["imprimatur"],
  "chronicle/jack-london": ["the-times"],
  "chronicle/polite_bureau": ["polite-bureau"],
};

/**
 * Public bento `href` paths (no leading slash) that do not match ontology layout 1:1.
 * Used by nav gate reads (`readNavGateFrontmatter`) and route discovery.
 */
export const BENTO_ROUTE_ONTOLOGY: Record<string, string> = {
  "governance/carta": "governance/Carta",
  "governance/canonical": "governance/Canonical",
  "governance/canonical-review": "governance/Canonical-Review",
  "governance/identity": "governance/identity/identity",
  "governance/capital": "governance/capital/capital",
  "governance/intelligence": "governance/intelligence/deus-en-machina",
  "governance/peridot": "governance/illumination/peridot",
  cord: "narrative/cord/cord",
  "chronicle/jack-london": "narrative/biography",
  "chronicle/polite_bureau": "narrative/comment/polite-bureau",
};
