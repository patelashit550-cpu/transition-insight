# LayerZero OFT — do not install in this repo

LayerZero's [Omnichain Fungible Token (OFT) Standard](https://docs.layerzero.network/v2/developers/evm/oft/quickstart) is a **contract** workspace (Hardhat/Foundry on EVM, Anchor on Solana). This repository is a **static Next.js reading site**.

## Do not

- `npm install @layerzerolabs/oft-evm` (or `-upgradeable`) into this `package.json`
- Run `npx create-lz-oapp@latest` in the site root
- Commit OFT program keypairs, `SOLANA_PRIVATE_KEY`, or LayerZero deployer secrets
- Put OFT deploy keys in GitHub Actions (same rule as `SOLANA_SIGNING_KEY` in `SECURITY.md`)

## Do (sibling workspace, on the laptop)

Solana-first — Connexion already has Solana RPC, and a Solana OFT must deploy **its own OFT Program** so this jurisdiction keeps Upgrade Authority:

```bash
LZ_ENABLE_SOLANA_OFT_EXAMPLE=1 npx create-lz-oapp@latest
```

Choose a directory **outside** this repo (or a clearly ignored sibling). Select `OFT (Solana)`. Follow [the example README](https://github.com/LayerZero-Labs/devtools/tree/main/examples/oft-solana).

EVM-only path (if you later add an Ethereum/Base mint):

```bash
npx create-lz-oapp@latest --example oft
```

Existing Solidity repo (not this one):

```bash
npm install @layerzerolabs/oft-evm
```

## Catalog in this repo

Typed endpoint IDs and scaffold commands live in `src/lib/oft.ts`. That module is documentation-as-code: it never deploys a token.

## Validate

```bash
npm run test:oft
```

`shouldInstallOftInThisRepo()` must stay `false`. `package.json` must not list `@layerzerolabs/*`.
