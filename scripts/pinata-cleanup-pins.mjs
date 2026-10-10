#!/usr/bin/env node
/**
 * Unpin old site uploads. Keeps the newest --keep=N (default 2) project uploads and any
 * --protect=<cid>. Uses the V3 Files API (scoped keys may lack the legacy pinList scope).
 *
 *   npm run pinata:cleanup -- --dry-run
 *   npm run pinata:cleanup -- --keep=2 --protect=<live cid>
 */
import { listPins, unpin } from "./lib/pinata.mjs";
import { selectPinsToRemove } from "./lib/publish-sol.mjs";

const args = process.argv.slice(2);
const option = (name) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1)?.trim();
const dryRun = args.includes("--dry-run");
const keep = Number(option("--keep") ?? 2);
const protect = [option("--protect"), option("--keep-cid")].filter(Boolean);

const toRemove = selectPinsToRemove(await listPins(), { keep, protect });
if (toRemove.length === 0) {
  console.log("pinata-cleanup: nothing to remove");
  process.exit(0);
}
for (const pin of toRemove) {
  if (dryRun) {
    console.log(`pinata-cleanup: would unpin ${pin.name || "?"} ${pin.cid} (${pin.datePinned})`);
    continue;
  }
  await unpin(pin.id);
  console.log(`pinata-cleanup: unpinned ${pin.name || "?"} ${pin.cid.slice(0, 12)}…`);
}
console.log(`pinata-cleanup: ${dryRun ? "would remove" : "removed"} ${toRemove.length} pin(s)`);
