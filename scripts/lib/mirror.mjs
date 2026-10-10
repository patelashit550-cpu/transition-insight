/**
 * Pure helpers for the GitHub Pages mirror (transition-insight.sol.site).
 * The mirror repo is a deploy target holding exactly one orphan commit of out/, force-pushed
 * each ship, so its history never grows by the size of the export.
 */

export const DEFAULT_MIRROR_REPO = "https://github.com/patelashit550-cpu/transition-insight-sol.git";
export const DEFAULT_MIRROR_CNAME = "transition-insight.sol.site";
export const MIRROR_BRANCH = "gh-pages";

/** owner/repo from an https or ssh GitHub remote URL (lower-cased), or null. */
export function githubSlug(url) {
  const match = String(url ?? "").trim().match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : null;
}

/**
 * Validate a mirror target before anything is force-pushed.
 * Never the source repo itself (force-pushing it would replace main's history).
 */
export function validateMirrorTarget({ remote, originUrl, cname }) {
  const problems = [];
  const target = githubSlug(remote);
  if (!target) problems.push(`mirror remote is not a GitHub repo URL: ${remote}`);
  if (target && target === githubSlug(originUrl)) {
    problems.push(`mirror remote ${target} is this repo's origin — refusing to force-push it`);
  }
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(String(cname ?? ""))) {
    problems.push(`invalid custom domain for CNAME: ${cname}`);
  }
  return { ok: problems.length === 0, target, problems };
}
