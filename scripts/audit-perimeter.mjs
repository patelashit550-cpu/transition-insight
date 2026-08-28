#!/usr/bin/env node
/**
 * Perimeter diagnostic for local/dev vs production.
 *
 *   npm run audit:perimeter              local git/env + GitHub + live origins
 *   npm run audit:perimeter -- --export  built out/ (CI)
 *   npm run audit:perimeter -- --github  Pages source, collaborators, env policy
 *   npm run audit:perimeter -- --live    live origins only
 *   npm run audit:perimeter -- --local   git/env only
 *
 * Exit 1 when any FAIL is recorded. WARN does not fail the process.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const CANONICAL_DEFAULT = "https://transition-insight.sol.site";
const CANONICAL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || CANONICAL_DEFAULT).replace(/\/$/, "");
const SNS = "transition-insight.sol";
const SOL_SITE = CANONICAL_DEFAULT;
const PAGES_MIRROR = "https://ashitmilne.xyz";
const CORPUS_SOLANA = "6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT";
const CORPUS_ETH = "0x07C51282DFf9193584e9936316f88D0709D55490";
const CORPUS_ENS = "ashitpatel.eth";
const CORPUS_BTC = "3P2eUwTBnmoDGq22QYFB2cX6TsVV38rJwh";
const PUBLIC_IDENTITY = {
  NEXT_PUBLIC_SITE_URL: CANONICAL_DEFAULT,
  NEXT_PUBLIC_SNS_DOMAIN: SNS,
  NEXT_PUBLIC_SOL_SITE_URL: SOL_SITE,
  NEXT_PUBLIC_SOLANA_WALLET_ADDRESS: CORPUS_SOLANA,
  NEXT_PUBLIC_ETH_WALLET_ADDRESS: CORPUS_ETH,
  NEXT_PUBLIC_ENS_DOMAIN: CORPUS_ENS,
  NEXT_PUBLIC_BTC_WALLET_ADDRESS: CORPUS_BTC,
};
const OLD_WEB = "https://transition-insight.com";
const EXPECTED_REPO = "patelashit550-cpu/transition-insight";
const FETCH_MS = 12_000;

const args = new Set(process.argv.slice(2));
const scoped = args.has("--local") || args.has("--export") || args.has("--live") || args.has("--github");
const wantLocal = args.has("--local") || !scoped;
const wantExport = args.has("--export");
const wantLive = args.has("--live") || !scoped;
const wantGitHub = args.has("--github") || !scoped;

/** @typedef {{ level: "fail" | "warn" | "ok"; area: string; message: string }} Finding */

/** @type {Finding[]} */
const findings = [];

function record(level, area, message) {
  findings.push({ level, area, message });
}

function git(argsList) {
  try {
    return execFileSync("git", argsList, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const err = /** @type {Error & { stderr?: string }} */ (error);
    return err.stderr?.trim() || err.message;
  }
}

function ghJson(argsList) {
  try {
    const raw = execFileSync("gh", argsList, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, data: JSON.parse(raw) };
  } catch (error) {
    const err = /** @type {Error & { stderr?: string }} */ (error);
    return { ok: false, error: err.stderr?.trim() || err.message };
  }
}

function isPlaceholderSecretValue(value) {
  const trimmed = value.replace(/^["']|["']$/g, "");
  return !trimmed || /^(<|…|\.\.\.|YOUR-|CHANGE-ME|xxx)/i.test(trimmed) || trimmed.length < 16;
}

function readIfExists(relPath) {
  const full = join(ROOT, relPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, "utf8");
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "out" ||
        entry.name === ".next" ||
        entry.name === "skills"
      ) {
        continue;
      }
      walkFiles(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function fetchMeta(url, method = "GET") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "transition-insight-perimeter-audit" },
    });
    const headers = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    let body = "";
    if (method === "GET" && res.status < 400) {
      body = await res.text();
    }
    return { ok: res.ok, status: res.status, headers, body, location: headers.location || null };
  } catch (error) {
    const err = /** @type {Error} */ (error);
    return { ok: false, status: 0, headers: {}, body: "", location: null, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

function header(meta, name) {
  return meta.headers[name.toLowerCase()] || "";
}

function auditLocal() {
  const remote = git(["remote", "get-url", "origin"]);
  if (remote.includes(EXPECTED_REPO)) {
    record("ok", "git", `origin is ${EXPECTED_REPO}`);
  } else {
    record("fail", "git", `origin is not ${EXPECTED_REPO}: ${remote}`);
  }

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  record("ok", "git", `current branch ${branch}`);

  const trackedEnv = git(["ls-files", ".env.local", ".env", "*.pem", "*.key"]);
  if (!trackedEnv) {
    record("ok", "secrets", "no .env.local / key files tracked");
  } else {
    record("fail", "secrets", `tracked secret-like paths: ${trackedEnv}`);
  }

  const skipNames = new Set(["package-lock.json", "audit-perimeter.mjs"]);
  const assignment = /(?:SOLANA_SIGNING_KEY|PINATA_JWT|ETHERSCAN_API_KEY|JUPITER_API_KEY|COLOSSEUM_COPILOT_PAT|VYBE_API_KEY)\s*=\s*(\S+)/g;
  const privateKey = /BEGIN (OPENSSH |RSA |EC )?PRIVATE KEY/;
  for (const file of walkFiles(ROOT)) {
    const name = file.split(/[/\\]/).pop() || "";
    if (skipNames.has(name) || name.endsWith(".ps1") || name.endsWith(".md") || name.endsWith(".example")) {
      continue;
    }
    let text = "";
    try {
      const stat = statSync(file);
      if (stat.size > 1_000_000) continue;
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (privateKey.test(text)) {
      record("fail", "secrets", `possible private key in ${file.replace(ROOT, ".")}`);
    }
    assignment.lastIndex = 0;
    let match = assignment.exec(text);
    while (match) {
      if (!isPlaceholderSecretValue(match[1] || "")) {
        record("fail", "secrets", `possible secret in ${file.replace(ROOT, ".")}`);
        break;
      }
      match = assignment.exec(text);
    }
  }

  const pkgRaw = readIfExists("package.json");
  if (pkgRaw) {
    const pkg = JSON.parse(pkgRaw);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const heavy = ["@phantom/cli", "@phantom/mcp-server", "@phantom/phantom-openclaw-plugin", "audit"];
    const present = heavy.filter((name) => name in deps);
    if (present.length) {
      record(
        "fail",
        "supply-chain",
        `unused/high-risk packages in package.json: ${present.join(", ")} (not imported by the static site)`,
      );
    } else {
      record("ok", "supply-chain", "no Phantom CLI / dummy audit package in package.json");
    }
    if (deps["@phantom/react-sdk"]) {
      record(
        "warn",
        "supply-chain",
        "@phantom/react-sdk is listed but Cord uses the browser extension, not the npm SDK",
      );
    }
  }

  if (existsSync(join(ROOT, ".env.local"))) {
    record("ok", "secrets", ".env.local present locally (gitignored) — keep PINATA_JWT / SOLANA_SIGNING_KEY / ETHERSCAN_API_KEY / JUPITER_API_KEY / COLOSSEUM_COPILOT_PAT / VYBE_API_KEY only there");
  } else {
    record("warn", "secrets", ".env.local missing — fine until you pin IPFS or sign attestation.json");
  }

  auditCommittedIdentity();
}

function auditGitHub() {
  const pages = ghJson(["api", `repos/${EXPECTED_REPO}/pages`]);
  if (!pages.ok) {
    record("warn", "github", `cannot read Pages settings (${pages.error})`);
    return;
  }
  const site = pages.data;
  if (site.build_type === "workflow") {
    record("ok", "github", "Pages source is GitHub Actions");
  } else {
    const branch = site.source?.branch || "unknown";
    record(
      "fail",
      "github",
      `Pages is still the legacy ${branch} publisher (build_type=${site.build_type}). GitHub → Settings → Pages → Build and deployment → Source: GitHub Actions. Until then ashitmilne.xyz ignores the Actions workflow.`,
    );
  }
  if (site.cname === "ashitmilne.xyz" && site.https_enforced) {
    record("ok", "github", "Pages mirror custom domain ashitmilne.xyz with HTTPS enforced");
  } else {
    record(
      "warn",
      "github",
      `Pages domain=${site.cname || "(none)"} https_enforced=${site.https_enforced} — optional mirror only; canonical is ${CANONICAL_DEFAULT}`,
    );
  }

  const policies = ghJson([
    "api",
    `repos/${EXPECTED_REPO}/environments/github-pages/deployment-branch-policies`,
  ]);
  if (policies.ok && Array.isArray(policies.data?.branch_policies)) {
    const names = policies.data.branch_policies.map((item) => item.name);
    if (names.length === 1 && names[0] === "main") {
      record("ok", "github", "github-pages environment deploys from main only");
    } else {
      record(
        "warn",
        "github",
        `github-pages environment allows ${names.join(", ") || "(none)"} — keep main only. GitHub → Settings → Environments → github-pages → remove other branches: https://github.com/${EXPECTED_REPO}/settings/environments`,
      );
    }
  }

  const collab = ghJson(["api", `repos/${EXPECTED_REPO}/collaborators`]);
  if (collab.ok && Array.isArray(collab.data)) {
    const logins = collab.data.map((item) => item.login);
    if (logins.length === 1 && logins[0] === "patelashit550-cpu") {
      record("ok", "github", "only patelashit550-cpu has repo write access");
    } else {
      record("fail", "github", `collaborators: ${logins.join(", ") || "(none)"}`);
    }
  } else if (!collab.ok) {
    record("warn", "github", `cannot list collaborators (${collab.error})`);
  }
}

function auditExport() {
  const out = join(ROOT, "out");
  if (!existsSync(out)) {
    record("fail", "export", "out/ missing — run npm run build:global first");
    return;
  }

  const security = readIfExists("out/.well-known/security.txt") || "";
  const expectedCanonical = `Canonical: ${CANONICAL_DEFAULT}/.well-known/security.txt`;
  if (security.includes(expectedCanonical)) {
    record("ok", "export", "security.txt Canonical matches production origin");
  } else {
    record("fail", "export", `security.txt Canonical must be ${expectedCanonical}`);
  }
  if (/Expires:\s*\S+/.test(security)) {
    record("ok", "export", "security.txt has Expires");
  } else {
    record("warn", "export", "security.txt missing Expires (RFC 9116)");
  }

  const auth = readIfExists("out/auth.md") || "";
  if (auth.includes(CANONICAL_DEFAULT)) {
    record("ok", "export", "auth.md uses canonical origin");
  } else {
    record("fail", "export", `auth.md must cite ${CANONICAL_DEFAULT}`);
  }
  if (auth.includes(`${OLD_WEB}/.well-known/`)) {
    record("fail", "export", "auth.md still points discovery URLs at transition-insight.com");
  }

  const provenanceRaw = readIfExists("out/.well-known/provenance.json");
  if (provenanceRaw) {
    const provenance = JSON.parse(provenanceRaw);
    if (provenance.canonical === CANONICAL_DEFAULT) {
      record("ok", "export", "provenance.json canonical origin");
    } else {
      record("fail", "export", `provenance.json canonical is ${provenance.canonical}`);
    }
    if (provenance.pool?.tier === "global") {
      record("ok", "export", "attestation tier is global (published/canonical only)");
    } else {
      record("fail", "export", `export attestation tier is ${provenance.pool?.tier} — drafts must not ship`);
    }
    if (!provenance.pool?.signature) {
      record("warn", "export", "attestation.json is unsigned — sign locally with SOLANA_SIGNING_KEY");
    }
  } else {
    record("fail", "export", "out/.well-known/provenance.json missing");
  }

  if (existsSync(join(out, "api"))) {
    record("fail", "export", "out/api present — Cord write API must not ship in the static export");
  } else {
    record("ok", "export", "no /api in static export");
  }
}

async function auditLive() {
  const sol = await fetchMeta(SOL_SITE);
  const solTitle = (sol.body.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
  if (sol.status === 200 && /web3 profile/i.test(solTitle)) {
    record(
      "fail",
      "sns",
      `${SOL_SITE} is still the Bonfida profile, not the IPFS site. Pin with npm run ship -- --ipfs, set on-chain IPFS (CID only), and Configure Sol.site CNAME + TXT _dnslink=/ipfs/<CID>. Do not set URL to ${PAGES_MIRROR} (Pages 404; URL wins over IPFS).`,
    );
  } else if (sol.status === 200) {
    record("ok", "sns", `${SOL_SITE} is reachable (title: ${solTitle || "unknown"})`);
  } else {
    record("fail", "sns", `${SOL_SITE} returned ${sol.status || sol.error}`);
  }

  const cors = header(sol, "access-control-allow-origin");
  if (cors === "*") {
    record("warn", "live", `${SOL_SITE} sends Access-Control-Allow-Origin: * (read-only static; expected)`);
  }

  const csp = header(sol, "content-security-policy");
  const nosniff = header(sol, "x-content-type-options");
  const frame = header(sol, "x-frame-options") || header(sol, "content-security-policy");
  if (!csp) {
    record("warn", "live", `no Content-Security-Policy on ${SOL_SITE}`);
  }
  if (!nosniff) {
    record("warn", "live", `no X-Content-Type-Options on ${SOL_SITE}`);
  }
  if (!frame) {
    record("warn", "live", "no X-Frame-Options / frame-ancestors (clickjacking)");
  }

  const http = await fetchMeta(SOL_SITE.replace("https://", "http://"), "HEAD");
  if (http.status >= 300 && http.status < 400 && (http.location || "").startsWith("https://")) {
    record("ok", "live", "HTTP redirects to HTTPS on sol.site");
  } else {
    record("warn", "live", `sol.site HTTP response ${http.status} location=${http.location || "(none)"}`);
  }

  const security = await fetchMeta(`${SOL_SITE}/.well-known/security.txt`);
  if (security.body.includes(`Canonical: ${CANONICAL_DEFAULT}/.well-known/security.txt`)) {
    record("ok", "live", "live security.txt Canonical matches sol.site");
  } else if (security.status === 200) {
    record("fail", "live", "live security.txt Canonical still points elsewhere");
  } else {
    record("fail", "live", `live security.txt returned ${security.status} — IPFS/SNS not serving the site yet`);
  }

  const provenance = await fetchMeta(`${SOL_SITE}/.well-known/provenance.json`);
  if (provenance.status === 200) {
    try {
      const data = JSON.parse(provenance.body);
      if (data.canonical === CANONICAL_DEFAULT) {
        record("ok", "live", "live provenance canonical matches sol.site");
      } else {
        record("fail", "live", `live provenance canonical is ${data.canonical}`);
      }
      if (!data.pool?.signature) {
        record("warn", "live", "live attestation is unsigned");
      }
    } catch {
      record("fail", "live", "live provenance.json is not valid JSON");
    }
  } else {
    record("fail", "live", `live provenance.json returned ${provenance.status}`);
  }

  const pages = await fetchMeta(`${PAGES_MIRROR}/`);
  if (pages.status === 200) {
    record("ok", "mirror", `${PAGES_MIRROR} still serves (optional GitHub Pages mirror)`);
  } else {
    record(
      "warn",
      "mirror",
      `${PAGES_MIRROR} returned ${pages.status || pages.error} — Pages is not canonical; restore only if you want a Web2 mirror`,
    );
  }

  recordIdentityFindings(ingestIdentityProbe(["--sns-only"]));

  const old = await fetchMeta(OLD_WEB);
  if (old.status === 403 || header(old, "cf-mitigated")) {
    record(
      "warn",
      "alias",
      `${OLD_WEB} is behind a Cloudflare challenge — stop advertising it as the canonical host`,
    );
  } else if (old.status === 200) {
    record("warn", "alias", `${OLD_WEB} still serves content — confirm you control it or drop the name`);
  }
}

function readEnvAssignment(text, key) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() !== key) continue;
    return trimmed.slice(eq + 1).trim();
  }
  return null;
}

function auditCommittedIdentity() {
  for (const name of [".env.production", ".env.development"]) {
    const text = readIfExists(name);
    if (!text) {
      record("fail", "identity", `${name} is missing`);
      continue;
    }
    let drifted = false;
    for (const [key, expected] of Object.entries(PUBLIC_IDENTITY)) {
      const actual = readEnvAssignment(text, key);
      if (actual !== expected) {
        drifted = true;
        record("fail", "identity", `${name} ${key}=${actual ?? "(missing)"} (expected ${expected})`);
      }
    }
    if (!drifted) {
      record("ok", "identity", `${name} public keys match canonical identity`);
    }
  }
}

function ingestIdentityProbe(flagArgs) {
  try {
    const raw = execFileSync(
      process.execPath,
      ["--experimental-strip-types", "scripts/probe-identity.ts", "--json", "--no-balances", ...flagArgs],
      {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 45_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return JSON.parse(raw);
  } catch (error) {
    const err = /** @type {Error & { stdout?: string; stderr?: string }} */ (error);
    const stdout = err.stdout?.toString() || "";
    try {
      return JSON.parse(stdout);
    } catch {
      record("warn", "identity", `identity probe failed (${err.stderr?.trim() || err.message})`);
      return null;
    }
  }
}

function recordIdentityFindings(report) {
  if (!report?.findings) return;
  for (const item of report.findings) {
    if (item.code === "env-file" || item.code === "process-env" || item.code === "signing-key-absent") {
      continue;
    }
    const level = item.level === "ok" || item.level === "warn" || item.level === "fail" ? item.level : "warn";
    record(level, "identity", item.message);
  }
}

function printReport() {
  const order = { fail: 0, warn: 1, ok: 2 };
  const sorted = [...findings].sort((a, b) => order[a.level] - order[b.level]);
  const counts = { fail: 0, warn: 0, ok: 0 };
  console.log(`Perimeter audit  canonical=${CANONICAL}`);
  console.log(`  local=${wantLocal} export=${wantExport} live=${wantLive} github=${wantGitHub}`);
  console.log("");
  for (const item of sorted) {
    counts[item.level] += 1;
    const tag = item.level.toUpperCase().padEnd(4);
    console.log(`${tag}  [${item.area}] ${item.message}`);
  }
  console.log("");
  console.log(`summary  fail=${counts.fail} warn=${counts.warn} ok=${counts.ok}`);
  if (counts.fail > 0) {
    console.log("next: fix FAIL items, then re-run. GitHub UI access limits are in SECURITY.md.");
    process.exit(1);
  }
}

const ran = [];
if (wantLocal) {
  auditLocal();
  ran.push("local");
}
if (wantExport) {
  auditExport();
  ran.push("export");
}
if (wantLive) {
  await auditLive();
  ran.push("live");
}
if (wantGitHub) {
  auditGitHub();
  ran.push("github");
}
if (ran.length === 0) {
  console.error("usage: node scripts/audit-perimeter.mjs [--local] [--export] [--live] [--github]");
  process.exit(2);
}
printReport();
