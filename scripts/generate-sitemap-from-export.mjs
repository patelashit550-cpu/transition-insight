/**
 * Build sitemap.xml + robots.txt from the static export in out/.
 * Routes are discovered from exported index.html files (organic truth of the deploy
 * artifact). Replace path discovery with graph queries when that layer exists.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");
const PUBLIC = path.join(ROOT, "public");

const ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ashitmilne.xyz"
).replace(/\/$/, "");

/** Top-level export dirs omitted from the public sitemap. */
const EXCLUDE_DIRS = new Set([
  "__p3",
  "_not-found",
  "404",
  "_next",
  ".well-known",
]);

function discoverPublicPaths(dir, segments = []) {
  const paths = [];
  const indexHtml = path.join(dir, "index.html");

  if (fs.existsSync(indexHtml)) {
    if (segments.length === 0) {
      paths.push("/");
    } else if (!EXCLUDE_DIRS.has(segments[0])) {
      paths.push(`/${segments.join("/")}/`);
    }
  }

  if (!fs.existsSync(dir)) return paths;

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (EXCLUDE_DIRS.has(ent.name) || ent.name.startsWith(".")) continue;
    paths.push(...discoverPublicPaths(path.join(dir, ent.name), [...segments, ent.name]));
  }

  return [...new Set(paths)].sort();
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemapXml(paths) {
  const urls = paths
    .map((p) => {
      const loc = escapeXml(`${ORIGIN}${p}`);
      const priority = p === "/" ? "1.0" : "0.7";
      const changefreq = p === "/" ? "weekly" : "monthly";
      return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function buildRobotsTxt() {
  return `User-Agent: *
Allow: /

Host: ${ORIGIN}
Sitemap: ${ORIGIN}/sitemap.xml
`;
}

function buildApiCatalog() {
  return {
    linkset: [
      {
        anchor: `${ORIGIN}/`,
        "service-desc": [
          {
            href: `${ORIGIN}/sitemap.xml`,
            type: "application/xml",
          },
          {
            href: `${ORIGIN}/openapi.json`,
            type: "application/json",
          },
        ],
        "service-doc": [
          {
            href: `${ORIGIN}/.well-known/agent-skills/index.json`,
            type: "application/json",
          },
          {
            href: `${ORIGIN}/.well-known/agent-skills/transition-insight/SKILL.md`,
            type: "text/markdown",
          },
          {
            href: `${ORIGIN}/auth.md`,
            type: "text/markdown",
          },
        ],
      },
    ],
  };
}

function buildOpenApi(paths) {
  const openapiPaths = {};
  for (const p of paths) {
    const route = p === "/" ? "/" : p.replace(/\/$/, "");
    openapiPaths[route] = {
      get: {
        operationId: `get${route.replace(/[^a-zA-Z0-9]/g, "_") || "Home"}`,
        summary: `Read public page at ${route}`,
        responses: {
          "200": {
            description: "HTML page (default) or markdown when Accept: text/markdown and zone supports conversion",
          },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Transition Insight — public content surface",
      version: "1.0.0",
      description:
        "Read-only GET routes for published essays and governance pages. No authentication required.",
    },
    servers: [{ url: ORIGIN }],
    paths: openapiPaths,
  };
}

function writeDiscoveryArtifacts(paths, sitemapXml, robotsTxt) {
  const apiCatalog = buildApiCatalog();
  const openapi = buildOpenApi(paths);
  const apiCatalogJson = `${JSON.stringify(apiCatalog, null, 2)}\n`;
  const openapiJson = `${JSON.stringify(openapi, null, 2)}\n`;

  for (const dir of [OUT, PUBLIC]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "sitemap.xml"), sitemapXml, "utf8");
    fs.writeFileSync(path.join(dir, "robots.txt"), robotsTxt, "utf8");
    fs.writeFileSync(path.join(dir, "openapi.json"), openapiJson, "utf8");
    fs.mkdirSync(path.join(dir, ".well-known"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".well-known", "api-catalog"), apiCatalogJson, "utf8");
  }

  const headersSrc = path.join(PUBLIC, "_headers");
  if (fs.existsSync(headersSrc)) {
    fs.copyFileSync(headersSrc, path.join(OUT, "_headers"));
  }
}

if (!fs.existsSync(OUT)) {
  console.error("generate-sitemap-from-export: out/ not found — run next build first");
  process.exit(1);
}

const paths = discoverPublicPaths(OUT);
if (paths.length === 0) {
  console.error("generate-sitemap-from-export: no public paths discovered in out/");
  process.exit(1);
}

const sitemapXml = buildSitemapXml(paths);
const robotsTxt = buildRobotsTxt();
writeDiscoveryArtifacts(paths, sitemapXml, robotsTxt);

console.log(`discovery: ${paths.length} URL(s) → sitemap, robots, api-catalog, openapi.json`);
for (const p of paths) console.log(`  ${ORIGIN}${p}`);
