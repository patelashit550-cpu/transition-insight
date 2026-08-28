import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const origin = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ashitmilne.xyz"
).replace(/\/$/, "");
const skillRel = ".well-known/agent-skills/transition-insight/SKILL.md";
const skillPath = join(root, "public", skillRel);
const indexPath = join(root, "public", ".well-known/agent-skills/index.json");

const skillBody = readFileSync(skillPath);
const digest = `sha256:${createHash("sha256").update(skillBody).digest("hex")}`;

const index = {
  $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  skills: [
    {
      name: "transition-insight",
      type: "skill-md",
      description:
        "Navigate and read Transition Insight essays, chronicles, and governance nodes.",
      url: `${origin}/${skillRel}`,
      digest,
    },
  ],
};

writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`agent-skills index: ${index.skills.length} skill(s), digest ${digest.slice(0, 20)}…`);
