const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"] as const;

/** Non-negative integer → Devanagari digits (e.g. 0 → ०, 12 → १२). */
export function toDevanagariNumeral(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n === 0) return DEVANAGARI_DIGITS[0];

  let out = "";
  let v = Math.floor(n);
  while (v > 0) {
    out = DEVANAGARI_DIGITS[v % 10]! + out;
    v = Math.floor(v / 10);
  }
  return out;
}
