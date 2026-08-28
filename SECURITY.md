# Security Policy

Transition Insight is a **public static reading site**. There is no user database, no production write API, and no server you SSH into.

The public origin is **GitHub Pages** at `https://ashitmilne.xyz` until SNS IPFS and sol.site DNSLink are set. `https://transition-insight.sol.site` stays the SNS destination. The perimeter is: your laptop, GitHub (source + Pages), IPFS pins (when you pin), and the Solana name `transition-insight.sol`.

## Canonical production

| Surface | Role | Access |
|---|---|---|
| `https://ashitmilne.xyz` | Live web (GitHub Pages) | Public read — restore by merging `deploy-pages.yml` to `main` |
| `https://transition-insight.sol.site` | SNS / IPFS destination | Public read after on-chain IPFS + sol.site DNSLink |
| `transition-insight.sol` | SNS name | IPFS + SOL records; not a vault |
| IPFS CID (`NEXT_PUBLIC_IPFS_CID`) | Content-addressed snapshot | Public read on a gateway that serves HTML |
| GitHub `patelashit550-cpu/transition-insight` | Source + Pages deploy | You only |
| WSL / Windows / `next dev` | Local studio (drafts, Cord compose) | Your machine only |

`transition-insight.com` is **not** canonical. Do not list it as the live origin.

### Public vs private

| Layer | What | Where |
|---|---|---|
| Public | Site URL, SNS name, Solana / ETH / BTC addresses, DID | `.env.production` and `.env.development` (`NEXT_PUBLIC_*`). Same set in local and global. |
| Private | `SOLANA_SIGNING_KEY` / `SOLANA_KEYPAIR_PATH`, `PINATA_JWT`, API keys | `.env.local` on the laptop. Never GitHub Actions, never `NEXT_PUBLIC_*`. |
| Content tier | `local` / `preprod` / `global` | Which essays ship. Does not change keys. |

The private key for `NEXT_PUBLIC_SOLANA_WALLET_ADDRESS` (`6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT`) is the signing identity for the whole application: attestation, SNS record updates, SPL sweeps into that treasury.

## What to run

From the repo, in PowerShell or WSL:

```powershell
# Device + WSL
npm run audit:windows-dev

# Git, secrets, identity, live Pages, SNS destination
npm run audit:identity
npm run audit:perimeter
npm run audit:github

# Public ship path: global export (IPFS-relative) + Pinata
npm run ship -- --ipfs

# After a production build (without pin)
npm run build:global
npm run audit:perimeter -- --export
npm run verify:sitemap:live
npm run content:verify
```

GitHub Actions (see `.github/README.md`):

- Composite action `.github/actions/setup-node` — Node 22 + `npm ci` (shared steps)
- `ci.yml` — unit tests on PRs and `main` (`npm test`). Lint is still local (`npm run lint`) until the existing React hook findings are cleared.
- `deploy-pages.yml` — global-tier export → GitHub Pages (`ashitmilne.xyz`), `main` only. Switches Pages source to GitHub Actions so the artifact is actually served.

Ship path (local → IPFS → sol.site):

```powershell
npm run ship -- --ipfs
```

Then on sns.id, with the **SNS registrant** key:

1. Set on-chain **IPFS** to the CID (CID only — no `/ipfs/` prefix).
2. Set on-chain **SOL** to the corpus wallet.
3. **Do not** set the URL record to `https://ashitmilne.xyz/` — Bonfida prefers URL over IPFS. Pages can stay the live Web2 origin without being the SNS URL.
4. Configure Sol.site: **CNAME** → `cloudflare-ipfs.com`, **TXT** `_dnslink` → `dnslink=/ipfs/<CID>`.

`gateway.pinata.cloud` refuses HTML. Use a dedicated Pinata gateway or Cloudflare DNSLink.

Cord `/api` is stashed during `build:global` and must not appear in `out/`.

## Do these now (live gaps)

The repo can diagnose. These cannot be done from git:

1. **Pin** the global export (`PINATA_JWT` in `.env.local`) and record the CID as `NEXT_PUBLIC_IPFS_CID`.
2. **SNS (`transition-insight.sol`):** registrant is currently **not** the advertised corpus wallet. Unify those keys, then set IPFS + SOL as above. Until then `transition-insight.sol.site` is a public Bonfida profile.
3. **Sweep** SOL/SPL from related wallets into the corpus treasury. SNS is a name, not a vault.
4. Reconnect GitHub Pages: Settings → Pages → Source **GitHub Actions**. `deploy-pages.yml` also attempts this on the next `main` run.

## Limit access (do these in GitHub / DNS / SNS)

These cannot be set from the repo. Do them in the browser while logged into **your** GitHub and domain accounts:

1. **GitHub account:** passkey or hardware 2FA. No SMS-only. Session: sign out unused devices.
2. **Repo → Settings → Collaborators:** only `patelashit550-cpu`. No outside write.
3. **Repo → Settings → Branches:** protect `main` — block force-push. Keep yourself as the only bypass if you still use `npm run ship -- --push`.
4. **Repo → Settings → Pages:** Source = GitHub Actions. Custom domain `ashitmilne.xyz`. This is the live origin until sol.site serves IPFS.
5. **Repo → Settings → Environments → `github-pages`:** deployment branches = `main` only if Pages stays enabled.
6. **Repo → Settings → Actions:** disable fork PRs from writing Pages; no extra `GITHUB_TOKEN` write scopes.
7. **Secrets:** do **not** put `SOLANA_SIGNING_KEY`, `SOLANA_KEYPAIR_PATH`, `PINATA_JWT`, `JUPITER_API_KEY`, `ETHERSCAN_API_KEY`, `COLOSSEUM_COPILOT_PAT`, `VYBE_API_KEY`, OFT program keypairs, or LayerZero deployer keys in GitHub Actions. Sign, pin, assemble Solana transactions, and call Jupiter / Etherscan / Colosseum Copilot / Vybe on the laptop (`.env.local`, gitignored). `@solana/web3.js` v1, `@solana/spl-token`, Jupiter Tokens, and Etherscan `tokentx` are CLI-only — they must not ship a private key or API key into the static build. Never `NEXT_PUBLIC_*` for those keys.
8. **Porkbun / DNS:** `ashitmilne.xyz` may stay pointed at GitHub Pages as a mirror. Lock the registrar account with 2FA.
9. **SNS (`transition-insight.sol`):** IPFS record + sol.site CNAME/`_dnslink` as above. Until you do, `.sol.site` is a public Bonfida profile — a different origin, not this app.
10. **WSL:** one distro (`Ubuntu-22.04`), default version 2. Do not store signing keys in a shared Windows folder with loose ACLs; keep `.env.local` in the repo clone.

## Local vs production content

| Tier | Command | What is visible |
|---|---|---|
| local | `npm run dev` | Drafts + Cord compose (laptop only) |
| preprod | `npm run build:preprod` | `review` + published — never point DNS/SNS/IPNS at this |
| global | `npm run build:global` / `npm run ship -- --ipfs` | `published` + `canonical` only |

## Solana RPC

The published site uses **PublicNode** (`solana-rpc.publicnode.com`) as a shared CORS gateway for epoch/slot only. It must not receive `getBalance` of the owner wallet. Paste a Helius / QuickNode / validator URL in the Cord RPC field (browser `localStorage` only). Never put API keys in `NEXT_PUBLIC_SOLANA_RPC_URL`. Connexion is Call / Telegram / Email only.

## Reporting a vulnerability

Email **patelashit550@gmail.com**. Please include the URL, the gap, and whether it is already public.

We will acknowledge as soon as practical. This site is static: typical issues are domain hijack, leaked signing keys, supply-chain in `package-lock.json`, or SNS records pointing at the wrong CID — not RCE on a web server.

## LayerZero OFT (not this repo)

The [OFT Standard](https://docs.layerzero.network/v2/developers/evm/oft/quickstart) is a contract workspace. Do **not** add `@layerzerolabs/*` to this `package.json`. Scaffold `create-lz-oapp` in a sibling directory on the laptop. OFT program keypairs, `SOLANA_PRIVATE_KEY`, and LayerZero deployer secrets stay local — never GitHub Actions. See `skills/layerzero-oft.md`.

## Colosseum Copilot (not the static site)

The Copilot API base (`COLOSSEUM_COPILOT_API_BASE=https://copilot.colosseum.com/api/v1`) is public. The Personal Access Token (`COLOSSEUM_COPILOT_PAT`) is not — keep it in `.env.local` and probe with `npm run copilot:status`. See `skills/colosseum-copilot.md`.
