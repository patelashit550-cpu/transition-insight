#!/usr/bin/env node
import { loadEnvFiles } from "./lib/load-env.mjs";

loadEnvFiles();

const jwt = process.env.PINATA_JWT?.trim();
if (!jwt) {
  console.error("PINATA_JWT missing");
  process.exit(1);
}

const keep = process.argv.find((a) => a.startsWith("--keep="))?.slice(7)?.trim();

const listRes = await fetch(
  "https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=100",
  { headers: { Authorization: `Bearer ${jwt}` } },
);
const list = await listRes.json();
const rows = list.rows ?? [];

const toRemove = rows.filter((row) => {
  if (keep && row.ipfs_pin_hash === keep) return false;
  const name = row.metadata?.name ?? "";
  return name === "out" || name === "planet-iii-site";
});

if (toRemove.length === 0) {
  console.log("pinata-cleanup: nothing to remove");
  process.exit(0);
}

for (const row of toRemove) {
  const hash = row.ipfs_pin_hash;
  const res = await fetch(
    `https://api.pinata.cloud/pinning/unpin/${hash}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } },
  );
  if (!res.ok) {
    console.error(`failed to unpin ${hash}: ${res.status}`);
    process.exit(1);
  }
  console.log(`unpinned ${row.metadata?.name ?? "?"} ${hash.slice(0, 12)}…`);
}

console.log(`pinata-cleanup: removed ${toRemove.length} pin(s)`);
