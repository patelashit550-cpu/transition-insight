# Security Policy

Transition Insight is a **public static reading site**. There is no user database, no production write API, and no server you SSH into. The perimeter is: your laptop, GitHub, GitHub Pages (`ashitmilne.xyz`), and the Solana name `transition-insight.sol`.

## Canonical production

| Surface | Role | Access |
|---|---|---|
| `https://ashitmilne.xyz` | Canonical web (GitHub Pages) | Public read |
| `transition-insight.sol` | SNS name | Must resolve to the canonical site, not a profile page |
| `https://transition-insight.sol.site` | Bonfida gateway for the SNS name | Public read — only after SNS URL/IPFS points at `ashitmilne.xyz` |
| GitHub `patelashit550-cpu/transition-insight` | Source + deploy | You only |
| WSL / Windows / `next dev` | Local studio (drafts, Cord compose) | Your machine only |

`transition-insight.com` is **not** canonical. Do not list it as the live origin.

## What to run

From the repo, in PowerShell or WSL:

```powershell
# Device + WSL
npm run audit:windows-dev

# Git, secrets, GitHub Pages source, live origins, SNS
npm run audit:perimeter
npm run audit:github

# After a production build
npm run build:global
npm run audit:perimeter -- --export
npm run verify:sitemap:live
npm run content:verify
```

GitHub Actions (see `.github/README.md`):

- Composite action `.github/actions/setup-node` — Node 22 + `npm ci` (shared steps)
- `ci.yml` — unit tests on PRs and `main` (`npm test`). Lint is still local (`npm run lint`) until the existing React hook findings are cleared.
- `deploy-pages.yml` — global-tier export + Pages, `main` only

Ship path (local → GitHub → Pages):

```powershell
npm run ship -- --push -m "Publish …"
```

That pushes `main`. GitHub Actions builds **global** tier (published/canonical only) and deploys Pages. Cord `/api` is stashed during that build and must not appear in `out/`.

## Do these now (live gaps)

The repo can diagnose. Remaining item that cannot be done from git:

1. **SNS (`transition-insight.sol`):** set the URL (or IPFS) record to `https://ashitmilne.xyz/`. Until then `transition-insight.sol.site` is a public Bonfida profile — a different origin. Skip until you have SOL for the record update.

Done: Pages builds from GitHub Actions; the `github-pages` environment deploys from `main` only.

## Limit access (do these in GitHub / DNS / SNS)

These cannot be set from the repo. Do them in the browser while logged into **your** GitHub and domain accounts:

1. **GitHub account:** passkey or hardware 2FA. No SMS-only. Session: sign out unused devices.
2. **Repo → Settings → Collaborators:** only `patelashit550-cpu`. No outside write.
3. **Repo → Settings → Branches:** protect `main` — block force-push, require the Pages workflow to pass. Keep yourself as the only bypass if you still use `npm run ship -- --push`.
4. **Repo → Settings → Pages:** already **GitHub Actions**. Do not switch back to the legacy `gh-pages` branch publisher.
5. **Repo → Settings → Environments → `github-pages`:** done — deployment branches = `main` only. Optional later: required reviewer (you) so a stolen PAT cannot ship instantly.
6. **Repo → Settings → Actions:** disable fork PRs from writing Pages; no extra `GITHUB_TOKEN` write scopes.
7. **Secrets:** do **not** put `SOLANA_SIGNING_KEY`, `SOLANA_KEYPAIR_PATH`, `PINATA_JWT`, `JUPITER_API_KEY`, `ETHERSCAN_API_KEY`, `COLOSSEUM_COPILOT_PAT`, `VYBE_API_KEY`, OFT program keypairs, or LayerZero deployer keys in GitHub Actions. Sign, pin, assemble Solana transactions, and call Jupiter / Etherscan / Colosseum Copilot / Vybe on the laptop (`.env.local`, gitignored). `@solana/web3.js` v1, `@solana/spl-token`, Jupiter Tokens, and Etherscan `tokentx` are CLI-only — they must not ship a private key or API key into the static Pages build. Never `NEXT_PUBLIC_*` for those keys.
8. **Porkbun / DNS:** `ashitmilne.xyz` A/AAAA (or CNAME) stay on GitHub Pages; HTTPS is already enforced. Lock the registrar account with 2FA.
9. **SNS (`transition-insight.sol`):** set the URL (or IPFS) record to `https://ashitmilne.xyz/`. Until you do, `.sol.site` is a public Bonfida profile — a different origin, not this app.
10. **WSL:** one distro (`Ubuntu-22.04`), default version 2. Do not store signing keys in a shared Windows folder with loose ACLs; keep `.env.local` in the repo clone.

## Local vs production content

| Tier | Command | What is visible |
|---|---|---|
| local | `npm run dev` | Drafts + Cord compose (laptop only) |
| preprod | `npm run build:preprod` | `review` + published — never point DNS/SNS at this |
| global | `npm run build:global` / CI | `published` + `canonical` only |

## Solana RPC

The published site uses **PublicNode** (`solana-rpc.publicnode.com`) as a shared CORS gateway for epoch/slot only. It must not receive `getBalance` of the owner wallet. Paste a Helius / QuickNode / validator URL in the Cord RPC field (browser `localStorage` only). Never put API keys in `NEXT_PUBLIC_SOLANA_RPC_URL`. Connexion is Call / Telegram / Email only.

## Reporting a vulnerability

Email **patelashit550@gmail.com**. Please include the URL, the gap, and whether it is already public.

We will acknowledge as soon as practical. This site is static: typical issues are domain hijack, leaked signing keys, supply-chain in `package-lock.json`, or SNS records pointing at the wrong host — not RCE on a web server.

## LayerZero OFT (not this repo)

The [OFT Standard](https://docs.layerzero.network/v2/developers/evm/oft/quickstart) is a contract workspace. Do **not** add `@layerzerolabs/*` to this `package.json`. Scaffold `create-lz-oapp` in a sibling directory on the laptop. OFT program keypairs, `SOLANA_PRIVATE_KEY`, and LayerZero deployer secrets stay local — never GitHub Actions. See `skills/layerzero-oft.md`.

## Colosseum Copilot (not the static site)

The Copilot API base (`COLOSSEUM_COPILOT_API_BASE=https://copilot.colosseum.com/api/v1`) is public. The Personal Access Token (`COLOSSEUM_COPILOT_PAT`) is not — keep it in `.env.local` and probe with `npm run copilot:status`. See `skills/colosseum-copilot.md`.
