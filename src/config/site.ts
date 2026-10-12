// src/config/site.ts
import { withBasePath } from "@/lib/base-path";
import { CANONICAL_SITE_URL } from "@/lib/public-identity";

/**
 * SiteIdentity: High-level metadata for the Planet-III project.
 * Aligned with the Header tagline for system consistency.
 */
export const SiteIdentity = {
  name: 'Transition Insight',
  description: 'HUMAN-CENTRIC GOVERNANCE FOR A NEW EARTH',
  url: CANONICAL_SITE_URL,
  icon: withBasePath("/visuals/icon.png"),
};

/**
 * Mobile Safeguards: Viewport constants to map into Root Layouts or UI wrappers.
 * Prevents fixed pixel truncation on high-density devices like the Galaxy S24.
 */
export const LayoutConfig = {
  contentShellMaxWidth: 'max-w-6xl', // Desktop maximum boundary
  mobileShellWidth: 'w-full',        // Liquid fluid scaling for smartphones
  textWrappingClasses: 'break-words whitespace-normal overflow-wrap-anywhere',
};

export type BentoSeriesItem = {
  name: string;
  desc: string;
  dataPoint: string;
  href: string;
  /**
   * Hub row on the home bento (Regnum Dei pillar, Peridot): a disclosure (closed by default)
   * that rolls open to list the hub's articles. Reading pages keep their own flat left nav.
   */
  collapsible?: boolean;
  /** `"utility"`: listed on its own line below the pillar sections (e.g. V≡RT under Telamon). */
  variant?: "utility";
  /** Parent disclosure on the home bento only (see {@link BentoGroups}). */
  group?: BentoGroupKey;
};

/**
 * Parent disclosures that fold several registry rows into one bento row.
 * Regnum Dei's subtitle is Carta's own gloss: "I translate it as Divine Governance".
 * Lingam's subtitle quotes Canonical's definition: literally "mark," "sign," "emblem".
 */
export const BentoGroups = {
  "regnum-dei": { name: "Regnum Dei", desc: "Divine Governance" },
  lingam: { name: "Lingam", desc: "Semantics" },
} as const;

export type BentoGroupKey = keyof typeof BentoGroups;

export type BentoSectionConfig = {
  title: string;
  label: string;
  /** Devanagari kicker paired with Latin `label` (Veritas / Utilitas / Firmitas). */
  nodeKicker: string;
  subtitle: string;
  status: string;
  /** When true, routes under this bento may require a signed-in session (auth TBD). */
  requiresAuth: boolean;
  series: BentoSeriesItem[];
  titleVisualSrc?: string;
  titleVisualAlt?: string;
};

/**
 * BentoRegistry: The Primary Content Map.
 */
export const BentoRegistry: Record<"B1" | "B2" | "B3", BentoSectionConfig> = {
  B1: {
    title: "Ashit Milne",
    label: "Veritas",
    nodeKicker: "सत्यम",
    subtitle: "Mine Identity",
    status: "NODE_ACTIVE // 001",
    requiresAuth: false,
    series: [
      { name: "Career Summary", desc: "Curriculum Vitae", dataPoint: "0xAF5", href: "/me/sku" },
      { name: "Origins", desc: "अर्थ — On Earth", dataPoint: "0xAF1", href: "/me/origins" },
      { name: "Trials of Job", desc: "気 — The Key Flows", dataPoint: "0xAF2", href: "/me/trials-of-job" },
      { name: "Praxis", desc: "πρᾶξις — Across Architecture", dataPoint: "0xAF3", href: "/me/praxis" },
      { name: "Connexion", desc: "Phone Jack", dataPoint: "0xAF4", href: "/me/connexion" },
    ],
  },
  B2: {
    title: "Telamon",
    label: "Utilitas",
    nodeKicker: "शिवम",
    subtitle: "Anarchism: An Ontology",
    status: "NODE_STABLE // 002",
    requiresAuth: false,
    series: [
      { name: "Carta", desc: "Introduction", dataPoint: "0xBF5", href: "/governance/carta" },
      // Regnum Dei: one row that rolls open to the three pillars, each of which rolls open to its articles.
      { name: "Sine Qua Non", desc: "Intelligence", dataPoint: "0xBF2", href: "/governance/intelligence", collapsible: true, group: "regnum-dei" },
      { name: "Dial Square", desc: "Identity", dataPoint: "0xBF1", href: "/governance/identity", collapsible: true, group: "regnum-dei" },
      { name: "E Pluribus Unum", desc: "Capital", dataPoint: "0xBF3", href: "/governance/capital", collapsible: true, group: "regnum-dei" },
      // Lingam: Peridot rolls open to its articles; Canonical and the review-stage glossary draft are single links.
      { name: "Peridot", desc: "Terms & Conditions", dataPoint: "0xBF4", href: "/governance/peridot", collapsible: true, group: "lingam" },
      { name: "Canonical", desc: "Glossary", dataPoint: "0xBF0", href: "/governance/canonical", group: "lingam" },
      { name: "Canonical Review", desc: "Glossary draft", dataPoint: "0xBF9", href: "/governance/canonical-review", group: "lingam" },
      // Utility of the ontology (moved from Bento 3). URL deliberately unchanged: /chronicle/argonaut-agentic.
      { name: "Argonaut Agentic", desc: "V≡RT", dataPoint: "0xCF6", href: "/chronicle/argonaut-agentic", variant: "utility" },
    ],
  },
  B3: {
    title: "Lens & Narrative",
    label: "Firmitas",
    nodeKicker: "सुन्दरम",
    subtitle: "Jackanory: The Tangent",
    status: "SIGNAL_LIVE // 003",
    requiresAuth: false,
    series: [
      { name: "The Times", desc: "By Jack London", dataPoint: "0xCF1", href: "/chronicle/jack-london" },
      { name: "Polite Bureau", desc: "Commentary", dataPoint: "0xCF3", href: "/chronicle/polite_bureau" },
      { name: "Skin in the Game", desc: "Tannery", dataPoint: "0xCF2", href: "/chronicle/skin-in-the-game" },
      { name: "London Calling", desc: "Tannoy", dataPoint: "0xCF5", href: "/chronicle/3am-eternal" },
    ],
  },
};
