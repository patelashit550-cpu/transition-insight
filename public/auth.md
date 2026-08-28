# auth.md — Transition Insight

## Audience

AI agents, crawlers, indexers, and human collaborators discovering content on
[ashitmilne.xyz](https://ashitmilne.xyz) (live GitHub Pages origin) and the
Solana name `transition-insight.sol`. `transition-insight.sol.site` is the
SNS / IPFS destination once on-chain IPFS and sol.site DNSLink are set.

## Registration

No OAuth, OIDC, or programmatic agent registration is required to read
published pages. The site is an open static node — discovery and reading are
intentionally unrestricted.

## Contact

- **Email:** [patelashit550@gmail.com](mailto:patelashit550@gmail.com)
- **security.txt:** https://ashitmilne.xyz/.well-known/security.txt

## Credentials

None for public essays, chronicles, or governance pages.

## Collaboration

Email to propose contributions, corrections, syndication, or research
collaboration. Doors stay open on the network.

## Provenance

Sovereign identity and corpus attestation for milling / noding agents:

- **Provenance:** https://ashitmilne.xyz/.well-known/provenance.json
- **Attestation manifest:** https://ashitmilne.xyz/attestation.json
- **Solana DID:** `did:pkh:solana:` + wallet in provenance document
- **SNS:** `transition-insight.sol` — IPFS record must be the live CID; SOL record must be the corpus wallet. Do not set URL to the Pages origin (URL wins over IPFS).

Verify `attestation.json` signature with `npm run content:verify` when a
signed manifest is published. Unsigned manifests list published ontology
files and SHA-256 digests only.

## Discovery

- Sitemap: https://ashitmilne.xyz/sitemap.xml
- Agent skills: https://ashitmilne.xyz/.well-known/agent-skills/index.json
- API catalog: https://ashitmilne.xyz/.well-known/api-catalog
