/**
 * Canonical essay images live in repo-root `assets/`.
 * Next static export serves them from `public/assets/` at `/assets/*`.
 *
 * Run before `npm run build` (wired in package.json prebuild).
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const ROOT = process.cwd();
const ONTOLOGY = path.join(ROOT, "ontology");
const ASSETS = path.join(ROOT, "assets");
const PUBLIC_ASSETS = path.join(ROOT, "public", "assets");

const PUBLISHED = new Set(["published", "canonical"]);

/** basename aliases: frontmatter name → file in assets/ */
const ALIASES = {
  "ashit_milne.jpg": ["AshitMilne.jpg", "ashit_milne.jpg"],
};

function listMarkdownFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listMarkdownFiles(full));
    else if (/\.mdx?$/i.test(ent.name)) out.push(full);
  }
  return out;
}

function imagePathFromFrontmatter(data) {
  const raw = data.image;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const p = raw.trim();
  if (!p.startsWith("/assets/") && !p.startsWith("/visuals/")) return null;
  return p;
}

function resolveInAssets(basename) {
  const direct = path.join(ASSETS, basename);
  if (fs.existsSync(direct)) return direct;

  const aliases = ALIASES[basename];
  if (aliases) {
    for (const name of aliases) {
      const fp = path.join(ASSETS, name);
      if (fs.existsSync(fp)) return fp;
    }
  }

  const caseInsensitive = fs
    .readdirSync(ASSETS)
    .find((f) => f.toLowerCase() === basename.toLowerCase());
  if (caseInsensitive) return path.join(ASSETS, caseInsensitive);

  return null;
}

function importFromLegacy(basename) {
  const legacyVisuals = path.join(ROOT, "public", "visuals", basename);
  if (fs.existsSync(legacyVisuals)) {
    const dest = path.join(ASSETS, basename);
    fs.copyFileSync(legacyVisuals, dest);
    console.log(`imported ${basename} → assets/ (from public/visuals)`);
    return dest;
  }

  const outVisuals = path.join(ROOT, "out", "visuals", basename);
  if (fs.existsSync(outVisuals)) {
    const dest = path.join(ASSETS, basename);
    fs.copyFileSync(outVisuals, dest);
    console.log(`imported ${basename} → assets/ (from out/visuals)`);
    return dest;
  }

  return null;
}

function sync() {
  fs.mkdirSync(ASSETS, { recursive: true });
  fs.mkdirSync(PUBLIC_ASSETS, { recursive: true });

  const needed = new Map();

  for (const file of listMarkdownFiles(ONTOLOGY)) {
    const { data } = matter(fs.readFileSync(file, "utf8"));
    const stage = String(data.stage ?? "draft").trim().toLowerCase();
    if (!PUBLISHED.has(stage)) continue;

    const imagePath = imagePathFromFrontmatter(data);
    if (!imagePath) continue;

    const basename = path.basename(imagePath);
    needed.set(basename, imagePath);
  }

  let ok = 0;
  for (const [basename, urlPath] of needed) {
    let src = resolveInAssets(basename);
    if (!src) src = importFromLegacy(basename);
    if (!src) {
      console.warn(`missing: ${basename} (referenced as ${urlPath})`);
      continue;
    }

    const canonical = path.join(ASSETS, basename);
    if (path.resolve(src) !== path.resolve(canonical)) {
      fs.copyFileSync(src, canonical);
    }

    fs.copyFileSync(canonical, path.join(PUBLIC_ASSETS, basename));
    ok++;
    console.log(`synced /assets/${basename}`);
  }

  console.log(`sync-published-assets: ${ok}/${needed.size} image(s)`);
  if (ok < needed.size) process.exitCode = 1;
}

sync();
