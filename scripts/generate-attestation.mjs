import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  getContentBuildTier,
  getSovereignEnv,
  isStageIncludedInBuild,
  listOntologyFiles,
  manifestDigestFromEntries,
  readOntologyEntry,
  sha256FileSync,
} from "./lib/content-provenance.mjs";

const tier = getContentBuildTier();
const generated = new Date().toISOString();
const identity = getSovereignEnv();

const allFiles = listOntologyFiles();
const entries = [];

for (const relativePath of allFiles) {
  const meta = readOntologyEntry(relativePath);
  const sha256 = await sha256FileSync(join(process.cwd(), "ontology", relativePath));
  entries.push({ ...meta, sha256 });
}

const attested = entries.filter((entry) => isStageIncludedInBuild(entry.stage, tier));
const manifestDigest = manifestDigestFromEntries(attested);

const attestation = {
  version: "1",
  generated,
  tier,
  manifestDigest,
  identity,
  summary: {
    totalOntologyFiles: entries.length,
    attestedFiles: attested.length,
    signedFiles: attested.filter((entry) => entry.signature).length,
  },
  attested: attested.map(({ path, stage, title, author, publishedAt, slug, series, sha256 }) => ({
    path,
    stage,
    title,
    author,
    publishedAt,
    slug,
    series,
    sha256,
  })),
  signature: null,
};

const outPath = join(process.cwd(), "public", "attestation.json");
writeFileSync(outPath, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");

console.log(
  `attestation: ${attested.length}/${entries.length} files (${tier}), digest ${manifestDigest.slice(0, 24)}…`,
);
