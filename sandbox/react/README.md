# ReAct sandbox: rules as tools

Local-only playground. Nothing here is built, published or shipped with the site (see "Why this never ships" below).

## What it is

ReAct ("Reason + Act") is a simple loop for an AI agent. The model writes a **Thought**, asks for an **Action** (a tool call), gets back an **Observation** (the tool's result), and repeats until it can give an **Answer**. Here the main tool is `apply_rule`. It loads one of your rule twins (a small JSON file) and applies it **in code**, so the model never decides the outcome itself. It only asks for the rule to be applied and then reports what the rule decided, citing the rule as `id@version`. A second tool, `lookup_source`, resolves the corpus-graph node the rule cites (e.g. `term:yield`), so every citation leads back into the site.

The demo gives the agent three made-up spend options (example data) and a **placeholder** rule. The placeholder is not your rule. It's there so the loop runs until you write the real one.

## Run it (no model, no signup)

From the repo root:

```bash
node sandbox/react/run.mjs
```

That runs the **scripted** mode: a fixed stand-in for the model that walks the full Thought → Action → Observation → Answer loop. It prints the decision, the rule citation, the ranking with reasons, and the path to a trace file in `sandbox/react/runs/` (a `.trace.md` to read and a `.trace.json` for machines). Add `-v` to watch each step.

Tests:

```bash
node --test sandbox/react/test/*.test.mjs
```

## Draft rule: the planet comes first

`rules/draft-planet-first.json` is Ashit's own spitball, marked `"draft": true` (version `0.3.0-draft`, license undecided). His words are kept verbatim in `source_text`. Run it on the example food data:

```bash
node sandbox/react/run.mjs --rule draft-planet-first --options examples/food.example.json
```

It decides in layers, all in code:

1. **Agency.** Only options matching what the person asked for (`request.want` in the options file) are considered. The rule ranks within that choice and never swaps in a different want. If nothing matches, there's no decision.
2. **Smallest transaction first.** Lower `amount` ranks first.
3. **Planet, in strict order: air, then water, then soil.** Each option declares `impact` per layer as `none`, `low`, `medium` or `high`. Anything undeclared counts as the worst level (harm presumed until shown otherwise). Soil may only be used for food, and less soil use ranks first.

**No transaction.** The cheapest option is always not to transact: amount 0, no impact on air, water or soil ("price - there is no transaction then Planet is happy"). The cost layer always sees it first, but agency still rules. `decision.abstain` sets what happens:

- `surface` (default): the output says so (`abstain_considered: true` and a line like "Cheapest option is not to transact (0, no planet impact); person's stated want is 'food', so the best transaction is ..."), then still returns the best actual transaction for the stated want.
- `choose`: returns `no-transaction` as the decision, but only when the stated want is not in `basic_wants` (food and water for now). It still reports the best actual transaction.
- `off`: the no-transaction option isn't considered.

`combine` is settled as `cost_then_planet` (price first). The other choice, `planet_gate_then_cost` (planet first, cost decides between equal impacts), is still there to compare. The demo prints the pick under every combine and planet_mode setting side by side. Still open:

- `planet_mode`: `rank` (planet only orders) or `gate` (also drops anything above `planet.gateMax`, set to `low` for now).
- `cost.band`: how close two amounts must be to count as "comparable". `0` means only identical amounts, so planet rarely gets a say under `cost_then_planet`.
- `basic_wants`: which wants count as basic needs, so that abstaining is never chosen for them.

**Scope: local only (a stated assumption).** The rule carries `"scope": "local"` and an `assumptions` entry in Ashit's words: "so planet is a 'local' objrctive - it never factors into the community or sovereign - that is our 'assumption' and 'useful lie'". This is an assumption the rule is built on, a deliberate "useful lie", not a claim about how the world works. The sandbox enforces it: asking it to evaluate this rule for a `community` or `sovereign` decision is refused.

### Net-neutral queue: who gets it first

When several people want the same limited supply, the order is net neutral: **location first, then first come, first served**. Nobody can pay to move up.

```bash
node sandbox/react/run.mjs --queue examples/queue.example.json
node sandbox/react/run.mjs --queue examples/queue.example.json --node-location "45.4215,-75.6972"
```

- Distance from the supply is measured in rings (`queue.rings_km`, now 5 / 50 / 500 km / beyond). The nearest ring goes first, and within a ring it's strictly arrival time. Exact distance inside a ring doesn't matter.
- Requests with no location go last. Ties on ring and time fall back to id order, so the result is always the same.
- `bid`, `price`, `payment`, `tip` and similar fields are never read for ordering. They're reported as ignored (or, with `queue.price_fields: "reject"`, the request is refused).
- **Every copy is its own node.** Distance is measured from the supply's own location if it gives one, otherwise from this node's `node_location`. Set it with `--node-location "lat,lon"` or `REACT_NODE_LOCATION`, falling back to `node_location` in the example file. A copy pulled down in Ottawa orders the same requests differently from one in Toronto.

The queue is a separate helper (`src/queue.mjs`), not part of option ranking.

## Point it at a real model (optional, free)

Any OpenAI-compatible server works. The free local option is [Ollama](https://ollama.com). It isn't installed. This laptop has about 7 GB of RAM and no GPU, so only small models (about 1–3B parameters) are realistic, e.g. `llama3.2:3b` (~2 GB) or `qwen2.5:1.5b` (~1 GB). They'll be slow-ish and sometimes fumble the format. That's fine: the rule's own output is what counts, and the run prints a WARNING if the model's answer disagrees with it.

```bash
# after installing Ollama and running: ollama pull llama3.2:3b
REACT_LLM=openai REACT_LLM_MODEL=llama3.2:3b node sandbox/react/run.mjs -v
```

A hosted provider works the same way. Set `REACT_LLM_BASE_URL` to its OpenAI-compatible URL and put the key in `REACT_LLM_API_KEY` in your shell (never in a file in the repo). No key is stored or needed for scripted mode or Ollama.

| Env var | Default | What it does |
|---|---|---|
| `REACT_LLM` | `scripted` | `scripted` or `openai` |
| `REACT_LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible endpoint (Ollama default) |
| `REACT_LLM_MODEL` | `llama3.2:3b` | model name on that server |
| `REACT_LLM_API_KEY` | unset | only for hosted providers; read from the environment only |
| `REACT_RULES_DIR` | `sandbox/react/rules` | where rule twins live; later `public/rules` |
| `REACT_GRAPH_PATH` | `public/.well-known/corpus-graph.json` | graph used to resolve `source` node ids |
| `REACT_TRACE_DIR` | `sandbox/react/runs` | where traces are written (gitignored) |
| `REACT_MAX_TURNS` | `6` | loop limit |
| `REACT_NODE_LOCATION` | unset | this node's `lat,lon` for `--queue` |

CLI flags: `--rule <id>`, `--options <file.json>`, `--llm scripted|openai`, `-v`, `--no-trace`, `--queue <file.json>`, `--node-location "lat,lon"`.

## Plug in a real rule

1. Copy `rules/example-basic-need-yield.json` to `rules/<your-id>.json`. The file name must equal the `id`.
2. Rewrite `statement`, `decision.tiers`, `reasons` and `source` in your terms. Point `source` at real graph nodes (`term:…`, `essay:…`). Delete `"placeholder": true`, set `version` (e.g. `1.0.0`) and `license`.
3. Run it: `node sandbox/react/run.mjs --rule <your-id>`.
4. For your own options, write a JSON file shaped like the files in `examples/` and add `--options path/to/file.json` (relative to where you are or to `sandbox/react`).

If something's wrong (bad JSON, a missing field, a `source` node that isn't in the graph), the run stops with a plain error rather than guessing. When twins move to `public/rules/`, run with `REACT_RULES_DIR=public/rules` and nothing else changes.

The schema (full version in `rule-twin.schema.json`):

```jsonc
{
  "id": "basic-need-yield",            // lowercase-dashed; equals the file name
  "version": "1.0.0",                   // bump whenever the logic changes; citations quote id@version
  "placeholder": false,                 // only true for example rules
  "draft": true,                        // your own rule, still being worked out
  "source_text": ["your words, verbatim"],
  "title": "Short human title",
  "statement": "The rule in one or two plain sentences.",
  "inputs": {
    "options": { "required": ["id", "label", "need"], "optional": ["amount", "currency"] }
  },
  "decision": {
    "type": "rank-by-tier",             // or "layered" (see rules/draft-planet-first.json); new types get added in src/rule-engine.mjs
    "field": "need",                    // which option field the tiers look at
    "tiers": [                          // best first
      { "id": "water", "matches": ["water", "sanitation"], "reason": "why this tier ranks here" }
    ],
    "unmatched": "last",                // or "exclude": what happens to options no tier matches
    "exclude": [ { "match": "speculation", "reason": "why it's ruled out" } ],
    "tieBreak": { "field": "amount", "order": "asc" }
  },
  "reasons": {                          // templates; {label}, {need}, {tier}, {tiers}, {tierId}, {tierReason}, {excludeReason}
    "ranked": "{label} serves '{need}' (tier {tier} of {tiers}). {tierReason}",
    "unmatched": "{label} serves '{need}', which no tier covers.",
    "excluded": "{label} is excluded: {excludeReason}",
    "selected": "Selected {label}."
  },
  "source": [ { "node": "term:yield", "passage": "anchor or short quote", "note": "" } ],
  "rails": [ { "standard": "ISO 20022", "element": "Purp/Cd", "maps": "decision.field", "note": "only where it genuinely fits" } ],
  "license": "your choice"
}
```

## What's here

- `run.mjs`: the demo command.
- `src/react-loop.mjs`: the ReAct loop.
- `src/tools.mjs`: `apply_rule` and `lookup_source`.
- `src/rule-engine.mjs`: loads, validates and evaluates rule twins (deterministic).
- `src/graph.mjs`: resolves corpus-graph node ids.
- `src/llm.mjs`: model backends (scripted, OpenAI-compatible).
- `src/prompt.mjs`: the system prompt.
- `src/queue.mjs`: the net-neutral queue (distance rings, then first come first served).
- `rules/`: twins: the placeholder and the `draft-planet-first` draft.
- `examples/`: made-up option sets (`spend-options.example.json`, `food.example.json`, `queue.example.json`).
- `test/`: `node --test` suite (uses a tiny fixture graph).
- `runs/`: traces (gitignored).

Plain JavaScript (`.mjs`), with no dependencies beyond Node 20+. It's JavaScript rather than TypeScript so the repo's `tsc` (which includes every `**/*.ts`) never sees it.

## Why this never ships

- The Next build only compiles `src/`, and the static export only copies `public/`.
- `tsconfig.json` includes `**/*.ts` and `**/*.tsx`, and this folder has neither.
- `npm run ship -- --push` stages an explicit list of paths (`ontology`, `public/...`, `src`, ...) that doesn't include `sandbox/`.
- Traces in `runs/` are gitignored. The folder itself is left visible to git so you can decide later whether to commit it as a dev tool.

## Credit and license

The loop and prompt are a JavaScript port of Simon Willison's [A simple Python implementation of the ReAct pattern for LLMs](https://til.simonwillison.net/llms/python-react-pattern) (2023), which is Apache License 2.0. A copy is in `LICENSE-APACHE-2.0.txt`. Changes: ported to async JavaScript, pluggable model backends, tools injected, tool errors returned as observations, a step trace, and rule-twin tools in place of the original Wikipedia, blog search and calculator. The ReAct pattern itself is from Yao et al., [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) (2022).
