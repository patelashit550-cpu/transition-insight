/**
 * Career timeline for <TrajectoryTimeline/> — four contiguous chapters (IBM → consulting →
 * Thomson Reuters → Transition Insight / Planet-III). Edit dates here only.
 */

export type Domain = "ibm" | "consulting" | "tr" | "planet";

export type Engagement = {
  id: string;
  org: string;
  role: string;
  short: string;
  domain: Domain;
  start: string; // YYYY-MM
  end: string; // YYYY-MM
};

export type Era = {
  id: string;
  label: string;
  start: string;
  end: string;
};

export const DOMAIN_LABELS: Record<Domain, string> = {
  ibm: "IBM Global Business Services",
  consulting: "Transition Insight Consulting",
  tr: "Thomson Reuters",
  planet: "Transition Insight / Planet-III",
};

export const DOMAIN_COLORS: Record<Domain, string> = {
  ibm: "#0f766e",
  consulting: "#7c3aed",
  tr: "#f59e0b",
  planet: "#10b981",
};

/** Four-chapter view. Last segment ends at `TIMELINE_RANGE` (bump endYear as years pass). */
export const ENGAGEMENTS: Engagement[] = [
  {
    id: "ibm",
    org: "IBM Global Business Services",
    role: "Programme / technology delivery (via IBM Canada & BTO)",
    short: "IBM",
    domain: "ibm",
    start: "1999-01",
    end: "2010-12",
  },
  {
    id: "ti-consulting",
    org: "Transition Insight",
    role: "Independent consulting — programme delivery",
    short: "Transition Insight",
    domain: "consulting",
    start: "2011-01",
    end: "2018-12",
  },
  {
    id: "thomson-reuters",
    org: "Thomson Reuters",
    role: "Sr. Agile Program Manager — ONESOURCE Tax Determination",
    short: "Thomson Reuters",
    domain: "tr",
    start: "2019-01",
    end: "2022-12",
  },
  {
    id: "ti-planet",
    org: "Transition Insight / Planet-III",
    role: "Sovereign work — governance & systemic transitions",
    short: "TI · Planet-III",
    domain: "planet",
    start: "2023-01",
    end: "2026-12",
  },
];

export const TIMELINE_RANGE = { startYear: 1999, endYear: 2027 } as const;
