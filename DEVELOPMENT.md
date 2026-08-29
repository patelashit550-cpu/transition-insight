# Local development

This project supports native Windows 11 and WSL 2. Use Node.js 22 and the
lockfile; do not mix `node_modules` between Windows and WSL.

## First-time setup

1. Install [Git](https://git-scm.com/downloads), [GitHub CLI](https://cli.github.com/),
   and Node.js 22.
2. Clone and authenticate:

   ```powershell
   gh auth login
   gh repo clone patelashit550-cpu/transition-insight
   cd transition-insight
   npm ci --no-audit --no-fund
   Copy-Item .env.local.example .env.local
   ```

3. Run the environment audit and tests:

   ```powershell
   npm run audit:windows-dev
   npm test
   npm run dev
   ```

The audit writes a secret-free report to
`%LOCALAPPDATA%\transition-insight\dev-env-audit.json`. It checks the GitHub
login, repository origin, IPFS CLI, and local daemon in addition to the core
toolchain.

## Local IPFS

Install either [IPFS Desktop](https://docs.ipfs.tech/install/ipfs-desktop/) or
the official [Kubo CLI](https://docs.ipfs.tech/install/command-line/). IPFS
Desktop starts and manages Kubo for you. With the CLI, initialize and start it:

```powershell
ipfs init
ipfs daemon
```

In another terminal, verify and publish the static export:

```powershell
ipfs id
npm run deploy:local
```

Kubo normally records its API multiaddr automatically. For a non-default node,
set `IPFS_API` in `.env.local` to a multiaddr such as
`/ip4/127.0.0.1/tcp/5001`. An HTTP or HTTPS URL is also accepted and converted
to Kubo's required multiaddr syntax. Set `IPFS_GATEWAY` when the gateway is not
`http://127.0.0.1:8080`.

Never expose Kubo's RPC port `5001` publicly. It controls the node.

## GitHub and releases

Use a feature branch and pull request for source changes. `main` is deployed by
`.github/workflows/deploy-pages.yml`; `.github/workflows/ci.yml` runs tests.
The release helper can build without pushing:

```powershell
npm run ship
```

`npm run ship -- --push` writes to `main` directly, so use it only when branch
protection and the intended release policy permit direct pushes.
