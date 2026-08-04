function parseDateValue(raw: unknown): number | null {
  if (raw == null) return null;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string") {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/** Resolve `publishedAt` or `date` frontmatter to epoch ms. */
export function essayDateMs(data: Record<string, unknown> | null | undefined): number | null {
  if (!data) return null;
  for (const key of ["publishedAt", "date"] as const) {
    const ms = parseDateValue(data[key]);
    if (ms != null) return ms;
  }
  return null;
}

export type EssayNavDate = {
  ms: number;
  iso: string;
  label: string;
};

/** Brutalist stamp for margin nav — `2026.07.06` (UTC calendar day). */
export function essayNavDate(data: Record<string, unknown>): EssayNavDate | null {
  const ms = essayDateMs(data);
  if (ms == null) return null;

  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const iso = `${y}-${m}-${day}`;

  return { ms, iso, label: `${y}.${m}.${day}` };
}

export function sortEssayStubsChronological<T extends { dateMs?: number; order: number; slug: string }>(
  stubs: T[]
): T[] {
  return [...stubs].sort((a, b) => {
    const am = a.dateMs ?? Number.POSITIVE_INFINITY;
    const bm = b.dateMs ?? Number.POSITIVE_INFINITY;
    if (am !== bm) return am - bm;
    if (a.order !== b.order) return a.order - b.order;
    return a.slug.localeCompare(b.slug);
  });
}
