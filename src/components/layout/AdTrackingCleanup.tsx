"use client";

import { useEffect } from "react";

const AD_TRACKING_PARAMS = [
  "gclid",
  "gclsrc",
  "gad_source",
  "dclid",
  "wbraid",
  "gbraid",
  "fbclid",
  "msclkid",
  "ttclid",
  "twclid",
  "li_fat_id",
] as const;

/** Strip ad-click query params on load — consent denied by default. */
export function AdTrackingCleanup() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!AD_TRACKING_PARAMS.some((p) => params.has(p))) return;
    AD_TRACKING_PARAMS.forEach((p) => params.delete(p));
    const qs = params.size ? `?${params.toString()}` : "";
    history.replaceState(null, "", `${window.location.pathname}${qs}${window.location.hash}`);
  }, []);

  return null;
}
