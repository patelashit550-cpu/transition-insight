"use client";

import { useEffect } from "react";

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      execute: (input: Record<string, unknown>) => Promise<unknown>;
    },
    options?: { signal?: AbortSignal }
  ) => void;
};

function getModelContext(): ModelContext | null {
  const nav = navigator as Navigator & { modelContext?: ModelContext };
  return nav.modelContext?.registerTool ? nav.modelContext : null;
}

async function fetchPublicPageUrls(): Promise<string[]> {
  const res = await fetch("/sitemap.xml", { cache: "no-store" });
  if (!res.ok) return [];
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

/** Registers WebMCP tools when the browser supports navigator.modelContext. */
export function WebMcpTools() {
  useEffect(() => {
    const mc = getModelContext();
    if (!mc) return;

    const abort = new AbortController();

    mc.registerTool(
      {
        name: "list_public_pages",
        description:
          "List canonical public page URLs on Transition Insight (from sitemap.xml).",
        inputSchema: { type: "object", properties: {} },
        execute: async () => {
          const pages = await fetchPublicPageUrls();
          return { pages, count: pages.length };
        },
      },
      { signal: abort.signal }
    );

    mc.registerTool(
      {
        name: "find_pages_by_path",
        description:
          "Filter Transition Insight public pages whose URL path contains a substring (case-insensitive).",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Substring to match in the URL path" },
          },
          required: ["query"],
        },
        execute: async (input) => {
          const query = String(input.query ?? "").toLowerCase();
          const pages = await fetchPublicPageUrls();
          const matches = query
            ? pages.filter((url) => url.toLowerCase().includes(query))
            : pages;
          return { query, matches, count: matches.length };
        },
      },
      { signal: abort.signal }
    );

    return () => abort.abort();
  }, []);

  return null;
}
