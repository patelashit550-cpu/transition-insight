---
stage: draft
node_id: 2964
jurisdiction: Ashit Milne
title: OFT
label: Omnichain Fungible Token
type: essay
theme: emerald
size: md
showInNav: false
tags:
  - money
  - capital
  - technology
  - solana
  - governance
---
### The primitive already named

The landscape essay treats a **fungible token** as what appears once a community is large enough that counterparties are strangers: a medium that funds roads, water, and perimeter, then takes a surcharge for the commons. [Why PoS](../../Why%20PoS.md) then asks for a *Regnum*-specific token on a proof-of-stake rail — Solana for micro-settlement, an EVM for the ReFi tools already written — without saying how **one** supply survives that split.

[Limitless](../../Limitless.md) already holds Ethereum and Solana as capital. Two ledgers, two units, two mint authorities, is the old wrapping problem: bridged IOUs that are not the thing itself. The LayerZero **Omnichain Fungible Token (OFT) Standard** is the current engineering answer: burn or lock on the source chain, mint or release on the destination, same total supply, no middlechain custodian.

That is worth installing. It is **not** worth installing *here*.

### Why not this repository

This repo is the public static reader (`transition-insight.sol.site`). Connexion probes Solana JSON-RPC; Cord talks to Phantom. There is no Hardhat, no Foundry, no Anchor, no Solidity. Official OFT install paths are:

- **New EVM project:** `npx create-lz-oapp@latest --example oft`
- **Existing EVM project:** `npm install @layerzerolabs/oft-evm`
- **Solana + EVM:** `LZ_ENABLE_SOLANA_OFT_EXAMPLE=1 npx create-lz-oapp@latest` (select `OFT (Solana)`)

Dropping `@layerzerolabs/oft-evm` into this `package.json` would pull contract tooling into a GitHub Pages site, enlarge the supply chain, and still not mint a token. Deployer keypairs must stay on the laptop — the same perimeter as `SOLANA_SIGNING_KEY`.

### Solana-first, because of Upgrade Authority

On Solana, LayerZero does not offer a shared OFT program you merely configure. Every program has an Upgrade Authority; whoever holds it can change every child OFT Store. The docs are explicit: **deploy your own OFT Program** so the mint's authority is this jurisdiction's, then create an OFT Store (PDA) per token.

That matches the self-sovereign posture already wired into Connexion (`did:pkh:solana:…`). The sibling workspace should be the Solana example, wired later to Ethereum or Base. Endpoint IDs this corpus already cares about:

| Chain | Network | LayerZero EID |
| --- | --- | --- |
| Solana | mainnet | 30168 |
| Solana | testnet | 40168 |
| Ethereum | mainnet | 30101 |
| Ethereum Sepolia | testnet | 40161 |
| Base | mainnet | 30184 |
| Polygon Amoy | testnet | 40267 |

Typed in `src/lib/oft.ts`. Agents must not treat that catalog as permission to install contracts into the reader.

### Immediate next step (not this PR)

On the laptop, in a **sibling** directory, scaffold `OFT (Solana)`, keep program keypairs out of git, and run the example's first Solana ↔ EVM transfer on **devnet / Sepolia**. Only after that mint exists should this site quote or send — a Connexion panel, not a second copy of LayerZero inside Next.js.

Until then, OFT stays a named standard: the fungible primitive, omnichain, with Upgrade Authority held here.
