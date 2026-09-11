import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { splitEmbeddedJsonLd } from "@/lib/json-ld";
import {
  rankCorpus,
  type CorpusDocument,
  type CorpusHit,
} from "@/lib/carta-ask-shared";

const GRAPH_PATH = path.join(process.cwd(), "public", ".well-known", "corpus-graph.json");
const VOCAB_CANDIDATES = [
  path.join(process.cwd(), "public", "ontology.jsonld"),
  path.join(process.cwd(), "public", "ontology", "index.json"),
];
const ONTOLOGY_ROOT = path.join(process.cwd(), "ontology");

type GraphEssay = {
  id: string;
  type: string;
  label: string;
  ontologyPath?: string;
  tags?: string[];
};

type GraphFile = {
  interior?: { nodes?: GraphEssay[] };
};

let cachedDocs: CorpusDocument[] | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function loadEssayDocuments(): CorpusDocument[] {
  if (!existsSync(GRAPH_PATH)) return [];
  const graph = readJson(GRAPH_PATH) as GraphFile;
  const nodes = graph.interior?.nodes ?? [];
  const docs: CorpusDocument[] = [];
  for (const node of nodes) {
    if (node.type !== "essay" || !node.ontologyPath) continue;
    const full = path.join(ONTOLOGY_ROOT, node.ontologyPath);
    if (!existsSync(full)) continue;
    const raw = readFileSync(full, "utf8");
    const { content } = matter(raw);
    const { prose } = splitEmbeddedJsonLd(content);
    docs.push({
      id: node.id,
      title: node.label || path.basename(node.ontologyPath, path.extname(node.ontologyPath)),
      kind: "essay",
      tags: Array.isArray(node.tags) ? node.tags : [],
      text: prose,
      path: node.ontologyPath,
    });
  }
  return docs;
}

function loadTermDocuments(): CorpusDocument[] {
  const vocabPath = VOCAB_CANDIDATES.find((p) => existsSync(p));
  if (!vocabPath) return [];
  const vocab = readJson(vocabPath);
  if (!isRecord(vocab) || !Array.isArray(vocab["@graph"])) return [];
  const docs: CorpusDocument[] = [];
  for (const entry of vocab["@graph"]) {
    if (!isRecord(entry)) continue;
    const type = entry["@type"];
    const isTerm = type === "schema:DefinedTerm" || type === "DefinedTerm";
    if (!isTerm) continue;
    const name = typeof entry["schema:name"] === "string" ? entry["schema:name"] : "";
    const description =
      typeof entry["schema:description"] === "string" ? entry["schema:description"] : "";
    if (!name || !description) continue;
    const id = typeof entry["@id"] === "string" ? entry["@id"] : `term:${name}`;
    const category = typeof entry["carta:category"] === "string" ? entry["carta:category"] : "term";
    docs.push({
      id,
      title: name,
      kind: "term",
      tags: [category.toLowerCase()],
      text: description,
      path: "ontology.jsonld",
    });
  }
  return docs;
}

export function loadCorpusDocuments(): CorpusDocument[] {
  if (cachedDocs) return cachedDocs;
  cachedDocs = [...loadEssayDocuments(), ...loadTermDocuments()];
  return cachedDocs;
}

/** Test helper — drop the process-lifetime cache. */
export function resetCorpusDocumentCache(): void {
  cachedDocs = null;
}

export function retrieveCorpus(question: string): CorpusHit[] {
  return rankCorpus(question, loadCorpusDocuments());
}
