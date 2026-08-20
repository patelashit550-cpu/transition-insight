# GitHub Actions

This repo is a **Node / Next.js** static site (`ashitmilne.xyz`). Do not add GitHub starter templates (Python/Conda, Docker, etc.).

There are **two layers**. Mixing them is what makes “composite workflows” confusing:

| Layer | Where | What it is | Trigger |
|---|---|---|---|
| Composite **action** | `.github/actions/setup-node/` | Reusable **steps** (`runs.using: composite`) | Never on its own |
| **Workflow** | `.github/workflows/*.yml` | Jobs that GitHub actually runs | `on: push` / `pull_request` / … |

```
.github/
  actions/
    setup-node/action.yml   ← composite action (Node 22 + npm ci)
  workflows/
    ci.yml                  ← PRs + main: unit tests (`npm test`)
    deploy-pages.yml        ← main only: global export → GitHub Pages
```

Call the composite from a workflow **after** checkout:

```yaml
- uses: actions/checkout@v4
- uses: ./.github/actions/setup-node
```

Do **not**:

- Put `on:` or `jobs:` in `action.yml` (that would be a workflow)
- Use `workflow_call` reusable workflows here — a third layer this repo does not need
- Run Conda / pytest on this tree (the only Python is a local emblem script)

Secrets (`SOLANA_SIGNING_KEY`, `JUPITER_API_KEY`, `ETHERSCAN_API_KEY`, …) stay on the laptop. CI never receives them.
