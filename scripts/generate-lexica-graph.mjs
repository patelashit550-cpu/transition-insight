#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import matter from "gray-matter";

import { walkFiles } from "./lib/walk-files.mjs";

const ROOT = process.cwd();
const ONTOLOGY_ROOT = join(ROOT, "ontology");
const LEXICA_PATH = join(ONTOLOGY_ROOT, "Lexica.md");
const CANON_PATH = join(ONTOLOGY_ROOT, "governance", "Canonical.md");
const CANON_PATH_FALLBACKS = [
  join(ONTOLOGY_ROOT, "governance", "canonical.md"),
  join(ONTOLOGY_ROOT, "governance", "Canon.md"),
  join(ONTOLOGY_ROOT, "governance", "canon.md"),
];
const INFERENCES_PATH = join(ROOT, "scripts", "data", "canonical-inferences.json");
const OUTPUT_ROOT = join(ROOT, "semantic-graph");
const TERMS_ROOT = join(OUTPUT_ROOT, "terms");

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "term";
}

function cleanTerm(value) {
  return value
    .replace(/^!?\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|", 1)[0]
    .split("#", 1)[0]
    .trim();
}

function parseLexica(raw) {
  const { content } = matter(raw);
  const lines = content.split(/\r?\n/);
  const entries = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    current.definition = current.definitionLines.join("\n").trim();
    delete current.definitionLines;
    entries.push(current);
    current = null;
  };

  for (const line of lines) {
    const match = line.match(/^\*\*([^*]+)\*\*(?:\s*(.*))?$/);
    if (match) {
      flush();
      current = {
        term: cleanTerm(match[1]),
        definitionLines: match[2]?.trim() ? [match[2].trim()] : [],
      };
      continue;
    }

    if (/^##\s+/.test(line)) {
      flush();
      continue;
    }

    if (current) current.definitionLines.push(line);
  }
  flush();

  const definitionsByKey = new Map();
  const duplicates = [];
  for (const entry of entries) {
    const key = entry.term.toLocaleLowerCase();
    if (definitionsByKey.has(key)) {
      duplicates.push(entry.term);
      const existing = definitionsByKey.get(key);
      if (entry.definition && !existing.definition.includes(entry.definition)) {
        existing.definition = [existing.definition, entry.definition].filter(Boolean).join("\n\n");
      }
      continue;
    }
    definitionsByKey.set(key, entry);
  }

  return { definitionsByKey, duplicates: [...new Set(duplicates)].sort() };
}

function parseCanon(raw) {
  const { content } = matter(raw);
  const lines = content.split(/\r?\n/);
  const definitionsByKey = new Map();
  const duplicates = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const definition = current.lines.join("\n").trim();
    const key = current.term.toLocaleLowerCase();
    if (definitionsByKey.has(key)) duplicates.push(current.term);
    else definitionsByKey.set(key, { term: current.term, definition });
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      flush();
      current = { term: cleanTerm(heading[1]), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  return { definitionsByKey, duplicates: [...new Set(duplicates)].sort() };
}

function extractWikiLinks(content) {
  const links = [];
  const matcher = /!?\[\[([^\]]+)\]\]/g;
  for (const match of content.matchAll(matcher)) {
    const term = cleanTerm(match[1]);
    if (term) links.push(term);
  }
  return links;
}

function extractFrontmatterTerms(data) {
  if (!Array.isArray(data.lexica)) return [];
  return data.lexica
    .filter((value) => typeof value === "string")
    .map(cleanTerm)
    .filter(Boolean);
}

function collectEssays() {
  return walkFiles(ONTOLOGY_ROOT)
    .filter(({ relativePath }) => /\.(md|mdx)$/i.test(relativePath))
    .filter(({ relativePath }) => {
      const normalized = normalizePath(relativePath).toLowerCase();
      return (
        normalized !== "lexica.md" &&
        normalized !== "canonical.md" &&
        normalized !== "canon.md" &&
        normalized !== "canonical.md" &&
        normalized !== "governance/canon.md" &&
        normalized !== "governance/canonical.md"
      );
    })
    .map(({ relativePath, absolutePath }) => {
      const raw = readFileSync(absolutePath, "utf8");
      const parsed = matter(raw);
      const title =
        typeof parsed.data.title === "string" && parsed.data.title.trim()
          ? parsed.data.title.trim()
          : basename(relativePath).replace(/\.(md|mdx)$/i, "");
      const stage =
        typeof parsed.data.stage === "string" && parsed.data.stage.trim()
          ? parsed.data.stage.trim().toLowerCase()
          : "unset";
      const frontmatterTerms = extractFrontmatterTerms(parsed.data);
      const bodyTerms = extractWikiLinks(parsed.content);
      const terms = new Map();

      for (const term of frontmatterTerms) {
        terms.set(term.toLocaleLowerCase(), { term, sources: new Set(["frontmatter"]) });
      }
      for (const term of bodyTerms) {
        const key = term.toLocaleLowerCase();
        const existing = terms.get(key);
        if (existing) existing.sources.add("body");
        else terms.set(key, { term, sources: new Set(["body"]) });
      }

      return {
        id: `essay:${normalizePath(relativePath).toLowerCase()}`,
        title,
        stage,
        ontologyPath: normalizePath(relativePath),
        vaultPath: `ontology/${normalizePath(relativePath).replace(/\.(md|mdx)$/i, "")}`,
        terms,
        searchText: `${title}\n${parsed.content}`,
      };
    })
    .sort((a, b) => a.ontologyPath.localeCompare(b.ontologyPath));
}

function countTermMentions(text, values) {
  const occupied = [];
  let count = 0;

  for (const value of [...new Set(values)].sort((a, b) => b.length - a.length)) {
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

function buildCanonicalEntries(definitionsByKey, inferences, essays) {
  const authored = new Map(
    [...definitionsByKey.values()].map((entry) => [
      entry.term.toLocaleLowerCase(),
      {
        term: entry.term,
        definition: entry.definition,
        status: "authored",
        confidence: "authoritative",
        aliases: [],
        supportingSources: [],
      },
    ])
  );

  const entries = new Map(authored);
  for (const inference of inferences) {
    const aliases = Array.isArray(inference.aliases) ? inference.aliases : [];
    const authoredAlias = [inference.term, ...aliases].find((value) =>
      authored.has(value.toLocaleLowerCase())
    );
    if (authoredAlias) entries.delete(authoredAlias.toLocaleLowerCase());

    entries.set(inference.term.toLocaleLowerCase(), {
      term: inference.term,
      definition: inference.definition,
      status: authoredAlias ? "authored-alias+synthesized" : "inferred",
      confidence: inference.confidence || "medium",
      aliases,
      supportingSources: Array.isArray(inference.sources) ? inference.sources : [],
    });
  }

  return [...entries.values()]
    .map((entry) => {
      const searchTerms = [entry.term, ...entry.aliases];
      const mentions = essays
        .map((essay) => {
          const count = countTermMentions(essay.searchText, searchTerms);
          return count ? { path: essay.ontologyPath, title: essay.title, stage: essay.stage, count } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));

      return {
        ...entry,
        mentionCount: mentions.reduce((total, mention) => total + mention.count, 0),
        mentionedBy: mentions,
      };
    })
    .sort((a, b) => a.term.localeCompare(b.term));
}

function seedCanon(entries) {
  const entryBlocks = entries.flatMap((entry) => {
    return [
      `## ${entry.term}`,
      "",
      entry.definition || "_Definition is currently empty._",
      "",
      ...(entry.aliases.length ? [`*Aliases: ${entry.aliases.join(", ")}*`, ""] : []),
    ];
  });

  const document = [
    "---",
    "title: Canonical",
    "stage: draft",
    "type: reference",
    "theme: emerald",
    "showInNav: false",
    "slug: canonical",
    "image: /assets/canon.jpg",
    "imageAlt: \"Canonical: an emerald eye formed by an O and inward-facing brackets\"",
    "imageRole: inset",
    "---",
    "",
    "# Canonical",
    "",
    "> The canonical semantic reference for this corpus. Terms are defined to stand on their own and are ordered alphabetically.",
    "",
    ...entryBlocks,
    "",
  ].join("\n");

  writeFileSync(CANON_PATH, document, "utf8");
}

function resolveCanonPath() {
  if (existsSync(CANON_PATH)) return CANON_PATH;
  for (const candidate of CANON_PATH_FALLBACKS) {
    if (existsSync(candidate)) return candidate;
  }
  return CANON_PATH;
}

function writeCanonicalJson(entries) {
  writeFileSync(
    join(OUTPUT_ROOT, "canonical.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "ontology/governance/Canonical.md",
        terms: entries,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function uniqueSlug(term, usedSlugs) {
  const base = slugify(term);
  let slug = base;
  let suffix = 2;
  while (usedSlugs.has(slug)) slug = `${base}-${suffix++}`;
  usedSlugs.add(slug);
  return slug;
}

function buildGraph(definitionsByKey, essays) {
  const termsByKey = new Map();

  for (const [key, entry] of definitionsByKey) {
    termsByKey.set(key, {
      id: `term:${key}`,
      term: entry.term,
      definition: entry.definition,
      defined: true,
      usages: [],
    });
  }

  for (const essay of essays) {
    for (const [key, usage] of essay.terms) {
      if (!termsByKey.has(key)) {
        termsByKey.set(key, {
          id: `term:${key}`,
          term: usage.term,
          definition: "",
          defined: false,
          usages: [],
        });
      }
      termsByKey.get(key).usages.push({
        essayId: essay.id,
        sources: [...usage.sources].sort(),
      });
    }
  }

  const usedSlugs = new Set();
  const terms = [...termsByKey.values()]
    .sort((a, b) => a.term.localeCompare(b.term))
    .map((term) => ({ ...term, slug: uniqueSlug(term.term, usedSlugs) }));
  const termById = new Map(terms.map((term) => [term.id, term]));

  const edges = [];
  for (const essay of essays) {
    for (const [key, usage] of essay.terms) {
      const term = termById.get(`term:${key}`);
      edges.push({
        id: `edge:${term.slug}:${slugify(essay.ontologyPath)}`,
        from: essay.id,
        to: term.id,
        sources: [...usage.sources].sort(),
      });
    }
  }

  return { terms, essays, edges };
}

function wikiFileLink(path, label) {
  return `[[${path}|${label}]]`;
}

function writeTermNotes(graph) {
  mkdirSync(TERMS_ROOT, { recursive: true });
  const essayById = new Map(graph.essays.map((essay) => [essay.id, essay]));

  for (const term of graph.terms) {
    const usageLines = term.usages
      .map((usage) => essayById.get(usage.essayId))
      .filter(Boolean)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((essay) => `- ${wikiFileLink(essay.vaultPath, essay.title)} — \`${essay.stage}\``);

    const note = [
      "---",
      "generated: true",
      "type: lexica-term",
      `defined: ${term.defined}`,
      "---",
      "",
      `# ${term.term}`,
      "",
      term.defined ? term.definition || "_Definition is currently empty._" : "_Used but not yet defined in `ontology/Lexica.md`._",
      "",
      "## Used by",
      "",
      usageLines.length ? usageLines.join("\n") : "_No explicit essay links yet._",
      "",
      `Source: ${wikiFileLink("ontology/Lexica", "Lexica")}`,
      "",
    ].join("\n");

    writeFileSync(join(TERMS_ROOT, `${term.slug}.md`), note, "utf8");
  }
}

function writeIndex(graph) {
  const termLines = graph.terms.map((term) => {
    const state = term.defined ? "defined" : "UNDEFINED";
    return `- ${wikiFileLink(`semantic-graph/terms/${term.slug}`, term.term)} — ${state}; ${term.usages.length} essay(s)`;
  });

  const index = [
    "---",
    "generated: true",
    "type: lexica-index",
    "---",
    "",
    "# Lexica graph index",
    "",
    "> Generated by `npm run lexica:graph`. Edit essays and `ontology/Lexica.md`, not this folder.",
    "",
    `Terms: **${graph.terms.length}** · Essays: **${graph.essays.length}** · Edges: **${graph.edges.length}**`,
    "",
    "Open `semantic-graph/lexica-graph.canvas` for the visual map.",
    "",
    "## Terms",
    "",
    ...termLines,
    "",
  ].join("\n");

  writeFileSync(join(OUTPUT_ROOT, "Lexica Graph Index.md"), index, "utf8");
}

function writeCoverage(graph, duplicates) {
  const undefinedTerms = graph.terms.filter((term) => !term.defined && term.usages.length);
  const unusedTerms = graph.terms.filter((term) => term.defined && !term.usages.length);
  const unlinkedEssays = graph.essays.filter((essay) => essay.terms.size === 0);
  const stageCounts = Object.entries(
    graph.essays.reduce((counts, essay) => {
      counts[essay.stage] = (counts[essay.stage] || 0) + 1;
      return counts;
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b));

  const section = (heading, rows, empty) => [
    `## ${heading}`,
    "",
    ...(rows.length ? rows : [empty]),
    "",
  ];

  const report = [
    "---",
    "generated: true",
    "type: lexica-coverage",
    "---",
    "",
    "# Lexica coverage",
    "",
    "> Generated by `npm run lexica:graph`. Includes every ontology essay regardless of stage.",
    "",
    `- Defined terms: **${graph.terms.filter((term) => term.defined).length}**`,
    `- Terms used explicitly: **${graph.terms.filter((term) => term.usages.length).length}**`,
    `- Essay–term edges: **${graph.edges.length}**`,
    `- Essays with explicit terms: **${graph.essays.length - unlinkedEssays.length}/${graph.essays.length}**`,
    `- Used but undefined: **${undefinedTerms.length}**`,
    `- Defined but unused: **${unusedTerms.length}**`,
    "",
    "## Essay stages",
    "",
    ...stageCounts.map(([stage, count]) => `- ${stage}: ${count}`),
    "",
    ...section(
      "Used but undefined",
      undefinedTerms.map(
        (term) => `- ${wikiFileLink(`semantic-graph/terms/${term.slug}`, term.term)} — ${term.usages.length} essay(s)`
      ),
      "_None._"
    ),
    ...section(
      "Defined but not explicitly linked",
      unusedTerms.map((term) => `- ${wikiFileLink(`semantic-graph/terms/${term.slug}`, term.term)}`),
      "_None._"
    ),
    ...section(
      "Essays without lexica links",
      unlinkedEssays.map((essay) => `- ${wikiFileLink(essay.vaultPath, essay.title)} — \`${essay.stage}\``),
      "_None._"
    ),
    ...section(
      "Duplicate definitions in Lexica",
      duplicates.map((term) => `- ${term}`),
      "_None._"
    ),
  ].join("\n");

  writeFileSync(join(OUTPUT_ROOT, "Lexica Coverage.md"), report, "utf8");
}

function writeCanvas(graph) {
  const nodes = [];
  const edges = [];
  const termNodeIds = new Map();
  const essayNodeIds = new Map();
  const termColumns = 4;
  const essayColumns = 4;
  const columnWidth = 390;
  const rowHeight = 120;
  const essayStartX = termColumns * columnWidth + 520;

  graph.terms.forEach((term, index) => {
    const id = `canvas-term-${index}`;
    termNodeIds.set(term.id, id);
    nodes.push({
      id,
      type: "file",
      file: `semantic-graph/terms/${term.slug}.md`,
      x: (index % termColumns) * columnWidth,
      y: Math.floor(index / termColumns) * rowHeight,
      width: 320,
      height: 80,
      color: term.defined ? "4" : "1",
    });
  });

  graph.essays.forEach((essay, index) => {
    const id = `canvas-essay-${index}`;
    essayNodeIds.set(essay.id, id);
    nodes.push({
      id,
      type: "file",
      file: `ontology/${essay.ontologyPath}`,
      x: essayStartX + (index % essayColumns) * columnWidth,
      y: Math.floor(index / essayColumns) * rowHeight,
      width: 320,
      height: 80,
      color: essay.stage === "published" || essay.stage === "canonical" ? "5" : "6",
    });
  });

  graph.edges.forEach((edge, index) => {
    edges.push({
      id: `canvas-edge-${index}`,
      fromNode: termNodeIds.get(edge.to),
      fromSide: "right",
      toNode: essayNodeIds.get(edge.from),
      toSide: "left",
    });
  });

  writeFileSync(
    join(OUTPUT_ROOT, "lexica-graph.canvas"),
    `${JSON.stringify({ nodes, edges }, null, 2)}\n`,
    "utf8"
  );
}

function main() {
  if (!existsSync(LEXICA_PATH)) throw new Error(`Missing ${LEXICA_PATH}`);
  if (!existsSync(INFERENCES_PATH)) throw new Error(`Missing ${INFERENCES_PATH}`);

  const inferences = JSON.parse(readFileSync(INFERENCES_PATH, "utf8"));
  const essays = collectEssays();

  const canonPath = resolveCanonPath();
  if (!existsSync(canonPath)) {
    const lexica = parseLexica(readFileSync(LEXICA_PATH, "utf8"));
    const seedEntries = buildCanonicalEntries(lexica.definitionsByKey, inferences, essays);
    seedCanon(seedEntries);
  }

  const resolvedCanon = resolveCanonPath();
  const { definitionsByKey, duplicates } = parseCanon(readFileSync(resolvedCanon, "utf8"));
  const graph = buildGraph(definitionsByKey, essays);
  const canonicalEntries = buildCanonicalEntries(definitionsByKey, inferences, essays);

  rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUTPUT_ROOT, { recursive: true });
  writeTermNotes(graph);
  writeIndex(graph);
  writeCoverage(graph, duplicates);
  writeCanvas(graph);
  writeCanonicalJson(canonicalEntries);

  const serializable = {
    generatedAt: new Date().toISOString(),
    source: normalizePath(relative(ROOT, LEXICA_PATH)),
    summary: {
      terms: graph.terms.length,
      definedTerms: graph.terms.filter((term) => term.defined).length,
      usedTerms: graph.terms.filter((term) => term.usages.length).length,
      essays: graph.essays.length,
      linkedEssays: graph.essays.filter((essay) => essay.terms.size).length,
      edges: graph.edges.length,
      usedButUndefined: graph.terms.filter((term) => !term.defined && term.usages.length).length,
      definedButUnused: graph.terms.filter((term) => term.defined && !term.usages.length).length,
      duplicateDefinitions: duplicates.length,
    },
    terms: graph.terms,
    essays: graph.essays.map(({ terms, searchText, ...essay }) => ({
      ...essay,
      terms: [...terms.values()].map((usage) => ({
        term: usage.term,
        sources: [...usage.sources].sort(),
      })),
    })),
    edges: graph.edges,
    duplicateDefinitions: duplicates,
  };

  writeFileSync(
    join(OUTPUT_ROOT, "lexica-graph.json"),
    `${JSON.stringify(serializable, null, 2)}\n`,
    "utf8"
  );

  console.log(
    [
      "lexica:graph generated",
      `${serializable.summary.terms} terms`,
      `${serializable.summary.essays} essays (all stages)`,
      `${serializable.summary.edges} edges`,
      `${serializable.summary.usedButUndefined} used but undefined`,
      `${serializable.summary.definedButUnused} defined but unused`,
      `${canonicalEntries.length} Canonical entries`,
      `output: ${normalizePath(relative(ROOT, OUTPUT_ROOT))}/`,
    ].join(" | ")
  );
}

main();
