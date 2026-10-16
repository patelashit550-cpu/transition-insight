# Ontology extract (prose → JSON)

Step 1 of the pipeline: reads an ontology markdown file, asks an LLM to pull out concepts
(name, definition, key attributes, related terms) and writes
`semantic-graph/concepts/<essay-slug>.json`.

## Setup (once)
    cd scripts/ontology-extract
    uv venv .venv && uv pip install -p .venv -r requirements.txt

## Run
    # MISTRAL_API_KEY is read from the repo's .env.local (gitignored);
    # an already-exported MISTRAL_API_KEY takes precedence.
    .venv/bin/python extract.py "../../ontology/governance/Canonical.md"
    .venv/bin/python extract.py --dry-run "../../ontology/governance/Canonical.md"   # no API call
    .venv/bin/python extract.py --provider ollama --model qwen2.5:3b FILE   # local (needs ollama + pip install ollama)

Default model: `mistral-small-latest` (override with `--model`).
