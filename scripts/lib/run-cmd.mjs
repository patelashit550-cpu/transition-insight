/**
 * child_process helpers without shell:true (repository guardrail).
 *
 * Windows cannot spawn `npm.cmd` with shell:false (EINVAL). Invoke npm via
 * `node …/npm-cli.js` instead — same binary Node uses, arg arrays only.
 *
 * Layouts differ by install:
 * - Official Windows/macOS pkg: `<prefix>/node_modules/npm/bin/npm-cli.js`
 * - nvm / many Unix builds: `<prefix>/lib/node_modules/npm/bin/npm-cli.js`
 * - Odd wrappers (cloud agents): resolve `npm` on PATH and realpath to npm-cli.js
 */
import { existsSync, realpathSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * @returns {string[]}
 */
function npmCliCandidatesBesideNode() {
  const binDir = dirname(process.execPath);
  return [
    join(binDir, "node_modules", "npm", "bin", "npm-cli.js"),
    join(binDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
}

/**
 * Follow PATH entries for `npm` / `npm.cmd` to a real npm-cli.js (Unix nvm
 * shims are symlinks; Windows often keeps npm beside node instead).
 * @returns {string | null}
 */
function npmCliJsFromPath() {
  const pathEnv = process.env.PATH ?? "";
  const names =
    process.platform === "win32" ? ["npm.cmd", "npm.exe", "npm"] : ["npm"];

  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = join(dir, name);
      if (!existsSync(candidate)) continue;
      try {
        const real = realpathSync(candidate);
        if (real.replace(/\\/g, "/").endsWith("/npm-cli.js")) {
          return real;
        }
        // Some installs expose a JS launcher next to npm-cli.js
        const sibling = join(dirname(real), "npm-cli.js");
        if (existsSync(sibling)) return realpathSync(sibling);
      } catch {
        /* keep searching */
      }
    }
  }
  return null;
}

export function npmCliJs() {
  for (const candidate of npmCliCandidatesBesideNode()) {
    if (existsSync(candidate)) return candidate;
  }
  const fromPath = npmCliJsFromPath();
  if (fromPath) return fromPath;

  throw new Error(
    `run-cmd: npm-cli.js not found beside node (${process.execPath}) or on PATH`,
  );
}

/**
 * Expand `npm` into `[node, npm-cli.js, …args]`. Other commands pass through.
 * @param {string} command
 * @param {string[]} args
 * @returns {{ command: string, args: string[] }}
 */
export function resolveSpawn(command, args) {
  if (command === "npm" || command === "npm.cmd") {
    return { command: process.execPath, args: [npmCliJs(), ...args] };
  }
  return { command, args };
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ stdio?: import("node:child_process").StdioOptions, cwd?: string, env?: NodeJS.ProcessEnv, encoding?: BufferEncoding | "buffer" }} [opts]
 */
export function runSync(command, args, opts = {}) {
  const resolved = resolveSpawn(command, args);
  return spawnSync(resolved.command, resolved.args, {
    stdio: opts.stdio ?? "inherit",
    shell: false,
    cwd: opts.cwd ?? process.cwd(),
    encoding: opts.encoding === undefined ? "utf8" : opts.encoding,
    env: opts.env ?? process.env,
  });
}
