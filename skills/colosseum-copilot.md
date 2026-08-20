# Colosseum Copilot — laptop CLI, not the static site

Colosseum Copilot is a research API for Solana/crypto hackathon projects. This repository is a **static Next.js reading site**. Copilot stays on the laptop (scripts + `.env.local`).

## Env

```bash
export COLOSSEUM_COPILOT_API_BASE="https://copilot.colosseum.com/api/v1"
export COLOSSEUM_COPILOT_PAT="your-token-here"
```

Generate the PAT at [arena.colosseum.org/copilot](https://arena.colosseum.org/copilot). Put it in `.env.local` (gitignored). Never `NEXT_PUBLIC_*`, never GitHub Actions.

The public API base is also in `.env.development` / `.env.production`. Override `COLOSSEUM_COPILOT_API_BASE` only to target a different Copilot environment.

## Do not

- Ship the PAT in the static build
- Add Copilot routes under `src/app/api` (Pages builds stash `/api`)
- Paste the PAT into Connexion, commit logs, or issue comments

## Validate

```bash
npm run test:colosseum-copilot
npm run copilot:status
```

Without a PAT, `/status` should return **401** (the public base is reachable). With a PAT, the probe prints `authenticated: true`.

Typed client: `src/lib/colosseum-copilot.ts`. Docs: [docs.colosseum.com/copilot](https://docs.colosseum.com/copilot).
