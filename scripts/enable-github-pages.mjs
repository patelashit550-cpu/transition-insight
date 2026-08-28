#!/usr/bin/env node
/**
 * Point this repo’s GitHub Pages source at GitHub Actions (`build_type=workflow`).
 *
 * The deploy job’s GITHUB_TOKEN has `pages: write` and can do this.
 * A cloud agent’s `gh` often cannot (403). Never exit 1 — upload still proceeds.
 *
 *   node scripts/enable-github-pages.mjs
 */
import { execFileSync } from "node:child_process";

const repo = process.env.GITHUB_REPOSITORY || "patelashit550-cpu/transition-insight";
const cname = "ashitmilne.xyz";

function ghJson(args) {
  try {
    const raw = execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    }).trim();
    return { ok: true, data: raw ? JSON.parse(raw) : null };
  } catch (error) {
    const err = /** @type {Error & { stderr?: string }} */ (error);
    return { ok: false, error: err.stderr?.trim() || err.message };
  }
}

function putPages(fields) {
  const args = [
    "api",
    "--method",
    "PUT",
    `repos/${repo}/pages`,
    "-H",
    "Accept: application/vnd.github+json",
  ];
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "boolean") {
      args.push("-F", `${key}=${value}`);
    } else {
      args.push("-f", `${key}=${String(value)}`);
    }
  }
  return ghJson(args);
}

const current = ghJson(["api", `repos/${repo}/pages`]);
if (!current.ok) {
  console.warn(`pages: cannot read settings (${current.error})`);
} else {
  const site = current.data;
  console.log(
    `pages: current build_type=${site.build_type} cname=${site.cname || "(none)"} https_enforced=${site.https_enforced}`,
  );
  if (site.build_type === "workflow" && site.cname === cname) {
    console.log("pages: already GitHub Actions with ashitmilne.xyz");
    process.exit(0);
  }
}

let result = putPages({ build_type: "workflow", cname, https_enforced: true });
if (!result.ok) {
  console.warn(`pages: PUT with https_enforced failed (${result.error})`);
  result = putPages({ build_type: "workflow", cname });
}

if (!result.ok) {
  console.warn(
    `pages: could not switch source (${result.error}). Set GitHub → Settings → Pages → Build and deployment → Source: GitHub Actions, then re-run this workflow.`,
  );
  process.exit(0);
}

const site = result.data || {};
console.log(
  `pages: now build_type=${site.build_type || "workflow"} cname=${site.cname || cname}`,
);
