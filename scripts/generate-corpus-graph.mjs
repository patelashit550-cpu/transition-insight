#!/usr/bin/env node
/**
 * Published corpus graph — one exterior network node, full interior mesh.
 *
 *   npm run graph:published
 *
 * Nodes: every ontology essay with stage published | canonical
 * Edges:
 *   - essay→essay   explicit [[wikilinks]] resolved to files
 *   - essay→term    lexica: frontmatter + unresolved [[term]] wikilinks
 *   - essay→term    Canon-term whole-word mentions (soft proxy)
 *   - essay→series  / essay→folder  structural membership
 *   - essay→tag     frontmatter tags
 *
 * Outputs:
 *   semantic-graph/corpus-graph.json
 *   semantic-graph/corpus-graph.canvas
 *   semantic-graph/Corpus Graph Index.md
 *   semantic-graph/Corpus Coverage.md
 *   public/.well-known/corpus-graph.json  (agent discovery surface)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import matter from "gray-matter";

import { isStageIncludedInBuild, normalizeStage } from "./lib/content-provenance.mjs";
import { walkFiles } from "./lib/walk-files.mjs";

const ROOT = process.cwd();
const ONTOLOGY_ROOT = join(ROOT, "ontology");
const OUTPUT_ROOT = join(ROOT, "semantic-graph");
const PUBLIC_GRAPH = join(ROOT, "public", ".well-known", "corpus-graph.json");
const CANON_CANDIDATES = [
  join(ONTOLOGY_ROOT, "governance", "Canonical.md"),
  join(ONTOLOGY_ROOT, "governance", "canonical.md"),
  join(ONTOLOGY_ROOT, "governance", "Canon.md"),
  join(ONTOLOGY_ROOT, "governance", "canon.md"),
];

const EXCLUDE = new Set([
  "lexica.md",
  "canonical.md",
  "canon.md",
  "governance/canon.md",
  "governance/canonical.md",
  "governance/canon.legacy.md",
]);

const NETWORK_NODE = {
  id: "node:transition-insight",
  label: "Transition Insight",
  kind: "semper-idem",
  discovery: {
    skill: "/.well-known/agent-skills/transition-insight/SKILL.md",
    graph: "/.well-known/corpus-graph.json",
    attestation: "/attestation.json",
    sitemap: "/sitemap.xml",
    apiCatalog: "/.well-known/api-catalog",
  },
};

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function slugify(value) {
  return (
    value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "node"
  );
}

function cleanWikiTarget(value) {
  return value
    .replace(/^!?\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|", 1)[0]
    .split("#", 1)[0]
    .trim();
}

function extractWikiLinks(content) {
  const links = [];
  const matcher = /!?\[\[([^\]]+)\]\]/g;
  for (const match of content.matchAll(matcher)) {
    const target = cleanWikiTarget(match[1]);
    if (target) links.push(target);
  }
  return links;
}

function extractFrontmatterTerms(data) {
  if (!Array.isArray(data.lexica)) return [];
  return data.lexica
    .filter((value) => typeof value === "string")
    .map(cleanWikiTarget)
    .filter(Boolean);
}

function extractTags(data) {
  if (!Array.isArray(data.tags)) return [];
  return data.tags
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseCanon(raw) {
  const { content } = matter(raw);
  const lines = content.split(/\r?\n/);
  const definitionsByKey = new Map();
  let current = null;

  const flush = () => {
    if (!current) return;
    const definition = current.lines.join("\n").trim();
    const key = current.term.toLocaleLowerCase();
    if (!definitionsByKey.has(key)) {
      definitionsByKey.set(key, { term: current.term, definition });
    }
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      flush();
      current = { term: cleanWikiTarget(heading[1]), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();
  return definitionsByKey;
}

function loadCanon() {
  for (const path of CANON_CANDIDATES) {
    if (existsSync(path)) return parseCanon(readFileSync(path, "utf8"));
  }
  return new Map();
}

function countTermMentions(text, values) {
  const occupied = [];
  let count = 0;
  for (const value of [...new Set(values)].sort((a, b) => b.length - a.length)) {
    if (value.length < 4) continue;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
    for (const match of text.matchAll(matcher)) {
      const start = match.index;
      const end = start + match[0].length;
      if (occupied.some(([from, to]) => start < to && end > from)) continue;
      occupied.push([start, end]);
      count += 1;
    }
  }
  return count;
}

function collectEssays() {
  return walkFiles(ONTOLOGY_ROOT)
    .filter(({ relativePath }) => /\.(md|mdx)$/i.test(relativePath))
    .filter(({ relativePath }) => {
      const normalized = normalizePath(relativePath).toLowerCase();
      return (
        !EXCLUDE.has(normalized) &&
        !normalized.endsWith("/canon.md") &&
        !normalized.endsWith("/canonical.md")
      );
    })
    .map(({ relativePath, absolutePath }) => {
      const raw = readFileSync(absolutePath, "utf8");
      const parsed = matter(raw);
      const ontologyPath = normalizePath(relativePath);
      const stem = basename(ontologyPath).replace(/\.(md|mdx)$/i, "");
      const title =
        typeof parsed.data.title === "string" && parsed.data.title.trim()
          ? parsed.data.title.trim()
          : stem;
      const stage = normalizeStage(parsed.data.stage);
      const slug =
        typeof parsed.data.slug === "string" && parsed.data.slug.trim()
          ? slugify(parsed.data.slug)
          : slugify(stem);
      const series =
        typeof parsed.data.series === "string" && parsed.data.series.trim()
          ? parsed.data.series.trim()
          : null;
      const folder = normalizePath(dirname(ontologyPath));
      const folderKey = folder === "." ? "ontology" : folder;

      return {
        id: `essay:${ontologyPath.toLowerCase()}`,
        type: "essay",
        title,
        stage,
        slug,
        series,
        folder: folderKey,
        ontologyPath,
        vaultPath: `ontology/${ontologyPath.replace(/\.(md|mdx)$/i, "")}`,
        tags: extractTags(parsed.data),
        lexicaTerms: extractFrontmatterTerms(parsed.data),
        wikiTargets: extractWikiLinks(parsed.content),
        searchText: `${title}\n${parsed.content}`,
        published: isStageIncludedInBuild(stage, "global"),
      };
    })
    .sort((a, b) => a.ontologyPath.localeCompare(b.ontologyPath));
}

function buildResolver(essays) {
  const byKey = new Map();
  const add = (key, essay) => {
    if (!key) return;
    const k = key.toLocaleLowerCase();
    if (!byKey.has(k)) byKey.set(k, essay);
  };

  for (const essay of essays) {
    add(essay.title, essay);
    add(essay.slug, essay);
    add(basename(essay.ontologyPath).replace(/\.(md|mdx)$/i, ""), essay);
    add(essay.ontologyPath.replace(/\.(md|mdx)$/i, ""), essay);
    add(essay.ontologyPath, essay);
    add(`ontology/${essay.ontologyPath.replace(/\.(md|mdx)$/i, "")}`, essay);
    // Common Obsidian short names
    add(essay.title.replace(/^The\s+/i, ""), essay);
  }
  return byKey;
}

function resolveWiki(target, resolver) {
  const raw = target.trim();
  const candidates = [
    raw,
    raw.replace(/\\/g, "/"),
    raw.replace(/^ontology\//i, ""),
    basename(raw.replace(/\\/g, "/")),
    slugify(raw),
  ];
  for (const c of candidates) {
    const hit = resolver.get(c.toLocaleLowerCase());
    if (hit) return hit;
  }
  return null;
}

function buildInterior(allEssays, canonByKey) {
  const essays = allEssays.filter((e) => e.published);
  const resolver = buildResolver(allEssays); // resolve against full vault so drafts can be targets later
  const publishedIds = new Set(essays.map((e) => e.id));

  const nodes = [];
  const edges = [];
  const edgeKeys = new Set();

  const pushEdge = (edge) => {
    const key = `${edge.from}|${edge.to}|${edge.kind}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ id: `edge:${slugify(key)}`, ...edge });
  };

  const seriesNodes = new Map();
  const folderNodes = new Map();
  const tagNodes = new Map();
  const termNodes = new Map();

  const ensureTerm = (term) => {
    const key = term.toLocaleLowerCase();
    if (!termNodes.has(key)) {
      const defined = canonByKey.has(key);
      termNodes.set(key, {
        id: `term:${key}`,
        type: "term",
        label: defined ? canonByKey.get(key).term : term,
        defined,
      });
    }
    return termNodes.get(key);
  };

  for (const essay of essays) {
    nodes.push({
      id: essay.id,
      type: "essay",
      label: essay.title,
      stage: essay.stage,
      slug: essay.slug,
      series: essay.series,
      folder: essay.folder,
      ontologyPath: essay.ontologyPath,
      vaultPath: essay.vaultPath,
      tags: essay.tags,
    });

    if (essay.series) {
      const sk = essay.series.toLocaleLowerCase();
      if (!seriesNodes.has(sk)) {
        seriesNodes.set(sk, {
          id: `series:${slugify(essay.series)}`,
          type: "series",
          label: essay.series,
        });
      }
      pushEdge({
        from: essay.id,
        to: seriesNodes.get(sk).id,
        kind: "member-of-series",
        weight: 1,
      });
    }

    {
      const fk = essay.folder.toLocaleLowerCase();
      if (!folderNodes.has(fk)) {
        folderNodes.set(fk, {
          id: `folder:${slugify(essay.folder)}`,
          type: "folder",
          label: essay.folder,
        });
      }
      pushEdge({
        from: essay.id,
        to: folderNodes.get(fk).id,
        kind: "member-of-folder",
        weight: 1,
      });
    }

    for (const tag of essay.tags) {
      const tk = tag.toLocaleLowerCase();
      if (!tagNodes.has(tk)) {
        tagNodes.set(tk, {
          id: `tag:${slugify(tag)}`,
          type: "tag",
          label: tag,
        });
      }
      pushEdge({
        from: essay.id,
        to: tagNodes.get(tk).id,
        kind: "tagged",
        weight: 1,
      });
    }

    for (const term of essay.lexicaTerms) {
      const t = ensureTerm(term);
      pushEdge({
        from: essay.id,
        to: t.id,
        kind: "lexica",
        weight: 2,
      });
    }

    for (const target of essay.wikiTargets) {
      const hit = resolveWiki(target, resolver);
      if (hit && publishedIds.has(hit.id) && hit.id !== essay.id) {
        pushEdge({
          from: essay.id,
          to: hit.id,
          kind: "wikilink",
          weight: 3,
        });
        continue;
      }
      // Unresolved or points at non-published essay → treat as term intention
      const t = ensureTerm(target);
      pushEdge({
        from: essay.id,
        to: t.id,
        kind: "wikilink-term",
        weight: 2,
      });
    }
  }

  const hasAnyEdge = (from, to) => {
    for (const k of edgeKeys) {
      if (k.startsWith(`${from}|${to}|`)) return true;
    }
    return false;
  };

  // Soft proxy: Canon term mentions in published essays
  for (const [, entry] of canonByKey) {
    if (entry.term.length < 4) continue;
    const termNode = ensureTerm(entry.term);
    for (const essay of essays) {
      if (hasAnyEdge(essay.id, termNode.id)) continue;
      const count = countTermMentions(essay.searchText, [entry.term]);
      if (count > 0) {
        pushEdge({
          from: essay.id,
          to: termNode.id,
          kind: "mention",
          weight: Math.min(count, 5),
          count,
        });
      }
    }
  }

  nodes.push(...seriesNodes.values(), ...folderNodes.values(), ...tagNodes.values(), ...termNodes.values());

  const degree = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) || 0) + 1);
    degree.set(e.to, (degree.get(e.to) || 0) + 1);
  }

  const orphanEssays = essays.filter((e) => {
    const d = degree.get(e.id) || 0;
    // Only structural folder edge → still "thin"
    const kinds = edges.filter((x) => x.from === e.id).map((x) => x.kind);
    const nonStructural = kinds.filter(
      (k) => k !== "member-of-folder" && k !== "member-of-series" && k !== "tagged"
    );
    return nonStructural.length === 0;
  });

  return {
    nodes,
    edges,
    essays,
    orphanEssays,
    summary: {
      essays: essays.length,
      nodes: nodes.length,
      edges: edges.length,
      byKind: edges.reduce((acc, e) => {
        acc[e.kind] = (acc[e.kind] || 0) + 1;
        return acc;
      }, {}),
      orphanEssays: orphanEssays.length,
      series: seriesNodes.size,
      folders: folderNodes.size,
      tags: tagNodes.size,
      terms: termNodes.size,
    },
  };
}

function writeCanvas(interior) {
  const essayNodes = interior.nodes.filter((n) => n.type === "essay");
  const otherNodes = interior.nodes.filter((n) => n.type !== "essay");
  const canvasNodes = [];
  const canvasEdges = [];
  const idMap = new Map();
  const cols = 5;
  const colW = 360;
  const rowH = 110;

  essayNodes.forEach((node, index) => {
    const id = `c-essay-${index}`;
    idMap.set(node.id, id);
    canvasNodes.push({
      id,
      type: "file",
      file: `ontology/${node.ontologyPath}`,
      x: (index % cols) * colW,
      y: Math.floor(index / cols) * rowH,
      width: 300,
      height: 80,
      color: node.stage === "canonical" ? "4" : "5",
    });
  });

  const otherStartY = Math.ceil(essayNodes.length / cols) * rowH + 160;
  otherNodes.forEach((node, index) => {
    const id = `c-other-${index}`;
    idMap.set(node.id, id);
    canvasNodes.push({
      id,
      type: "text",
      text: `${node.type}: ${node.label}`,
      x: (index % cols) * colW,
      y: otherStartY + Math.floor(index / cols) * 90,
      width: 280,
      height: 60,
      color: node.type === "term" ? (node.defined ? "4" : "1") : "6",
    });
  });

  // Prefer wikilink / lexica edges on canvas to avoid spaghetti
  const preferred = new Set(["wikilink", "lexica", "wikilink-term", "member-of-series"]);
  interior.edges
    .filter((e) => preferred.has(e.kind))
    .forEach((edge, index) => {
      const from = idMap.get(edge.from);
      const to = idMap.get(edge.to);
      if (!from || !to) return;
      canvasEdges.push({
        id: `c-edge-${index}`,
        fromNode: from,
        fromSide: "right",
        toNode: to,
        toSide: "left",
        label: edge.kind,
      });
    });

  writeFileSync(
    join(OUTPUT_ROOT, "corpus-graph.canvas"),
    `${JSON.stringify({ nodes: canvasNodes, edges: canvasEdges }, null, 2)}\n`,
    "utf8"
  );
}

function writeIndex(doc) {
  const { interior, networkNode } = doc;
  const essayLines = interior.nodes
    .filter((n) => n.type === "essay")
    .map((n) => `- [[${n.vaultPath}|${n.label}]] — \`${n.stage}\``);

  const md = [
    "---",
    "generated: true",
    "type: corpus-index",
    "---",
    "",
    "# Corpus graph index",
    "",
    `> Exterior network node: **${networkNode.label}** (\`${networkNode.id}\`)`,
    "",
    `Essays: **${interior.summary.essays}** · Interior nodes: **${interior.summary.nodes}** · Edges: **${interior.summary.edges}**`,
    "",
    "Open `semantic-graph/corpus-graph.canvas` in Obsidian.",
    "Agents: `/.well-known/corpus-graph.json`",
    "",
    "## Published essays",
    "",
    ...essayLines,
    "",
  ].join("\n");

  writeFileSync(join(OUTPUT_ROOT, "Corpus Graph Index.md"), md, "utf8");
}

function writeCoverage(doc) {
  const { interior } = doc;
  const kindLines = Object.entries(interior.summary.byKind)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `- ${k}: ${n}`);

  const orphans = interior.orphanEssays.map(
    (e) => `- [[${e.vaultPath}|${e.title}]] — \`${e.stage}\` (folder/series/tags only)`
  );

  const md = [
    "---",
    "generated: true",
    "type: corpus-coverage",
    "---",
    "",
    "# Corpus coverage",
    "",
    "> Published/canonical interior of the Transition Insight network node.",
    "",
    `- Essays on graph: **${interior.summary.essays}**`,
    `- Thin essays (no wikilink/lexica/mention): **${interior.summary.orphanEssays}**`,
    "",
    "## Edge kinds",
    "",
    ...kindLines,
    "",
    "## Thin essays",
    "",
    ...(orphans.length ? orphans : ["_None._"]),
    "",
    "## How to densify",
    "",
    "- Add `[[Essay Title]]` wikilinks between related published pieces",
    "- Add `lexica:` frontmatter for Canon terms",
    "- Keep `tags:` and `series:` for structural mesh",
    "",
  ].join("\n");

  writeFileSync(join(OUTPUT_ROOT, "Corpus Coverage.md"), md, "utf8");
}

function main() {
  const allEssays = collectEssays();
  const canonByKey = loadCanon();
  const interior = buildInterior(allEssays, canonByKey);

  const doc = {
    generatedAt: new Date().toISOString(),
    networkNode: NETWORK_NODE,
    interior: {
      summary: interior.summary,
      nodes: interior.nodes,
      edges: interior.edges.map(({ id, from, to, kind, weight, count }) => ({
        id,
        from,
        to,
        kind,
        weight,
        ...(count != null ? { count } : {}),
      })),
    },
  };

  mkdirSync(OUTPUT_ROOT, { recursive: true });
  mkdirSync(dirname(PUBLIC_GRAPH), { recursive: true });

  const json = `${JSON.stringify(doc, null, 2)}\n`;
  writeFileSync(join(OUTPUT_ROOT, "corpus-graph.json"), json, "utf8");
  writeFileSync(PUBLIC_GRAPH, json, "utf8");
  writeCanvas(interior);
  writeIndex(doc);
  writeCoverage({ ...doc, interior: { ...doc.interior, orphanEssays: interior.orphanEssays } });

  console.log(
    [
      "graph:published",
      `node=${NETWORK_NODE.id}`,
      `${interior.summary.essays} essays`,
      `${interior.summary.nodes} interior nodes`,
      `${interior.summary.edges} edges`,
      `${interior.summary.orphanEssays} thin essays`,
      `public: ${normalizePath(relative(ROOT, PUBLIC_GRAPH))}`,
    ].join(" | ")
  );
}

main();
