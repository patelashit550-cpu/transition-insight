---
name: iso20022-e-repository
description: >
  Local ISO 20022 EMF e-Repository — institutional Data Dictionary and Business
  Process Catalogue used as read-only source-of-truthiness when mapping ontology
  or agent intent to payment message shapes (pain / pacs / camt). Use when doing
  agentic payments mapping, validating field names, or relating identity /
  party / agent concepts to rail vocabulary. Not for essay drafting.
---

# ISO 20022 e-Repository

## Location (local only)

Path relative to the transition-insight repo root:

```
.refs/iso20022/
```

| Artifact | Purpose |
|----------|---------|
| `ISO20022.ecore` | EMF metamodel |
| `20260904_ISO20022_2013_eRepository.iso20022` | Full e-Repository |
| `README.md` | Human/agent orientation |

This directory is **gitignored** (`.refs/`). If missing, obtain the e-Repository from the [ISO 20022 RA](https://www.iso20022.org/iso20022-repository/e-repository) and place it there.

## Role in the stack

- **`ontology/`** — Ashit’s meanings and semantic perimeter (committed, published).
- **`.refs/iso20022/`** — institutional vocabulary for rails (local reference).
- Agents map across the two; they do not merge EMF into markdown essays.

## Rules of use

1. Read-only. Never treat the e-Repository as editable product code.
2. Prefer thin extracts (specific message components / data types) over dumping the whole model into context.
3. When emitting or validating payment-shaped payloads, check dictionary names before inventing JSON keys.
4. XSDs for a single message (e.g. pain.001) may be pulled from the [message archive](https://www.iso20022.org/message_archive.page) if code generation is needed — still keep them under `.refs/`, not `public/`.

## Related site discovery (published)

Agent-facing site skills remain under `public/.well-known/agent-skills/`. This skill is **dev-local** under `.agents/skills/` for coding/agent tooling inside the repo.
