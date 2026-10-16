"use client";

import { useEffect } from "react";

/** Cloudflare Web Analytics: one beacon per host so each site reports to its own dashboard. */
const TOKENS: Record<string, string> = {
  "transition-insight.sol.site": "9f6ec26b1235419baa1d86bd61bb2980",
  "ashitmilne.xyz": "ef48474253614aeb9e4809a9359212ed",
  "www.ashitmilne.xyz": "ef48474253614aeb9e4809a9359212ed",
};

export function CfAnalytics() {
  useEffect(() => {
    const token = TOKENS[window.location.hostname];
    if (!token) return;
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token }));
    document.body.appendChild(s);
  }, []);
  return null;
}
