# auth.md — Transition Insight

## Audience

AI agents, crawlers, indexers, and human collaborators discovering content on
[transition-insight.com](https://transition-insight.com) and
[transition-insight.sol.sites](https://transition-insight.sol.sites).

## Registration

No OAuth, OIDC, or programmatic agent registration is required to read
published pages. The site is an open static node — discovery and reading are
intentionally unrestricted.

## Contact

- **Email:** [ash@transition-insight.com](mailto:ash@transition-insight.com)
- **security.txt:** https://transition-insight.com/.well-known/security.txt

## Credentials

None for public essays, chronicles, or governance pages.

## Collaboration

Email to propose contributions, corrections, syndication, or research
collaboration. Doors stay open on the network.

## Provenance

Sovereign identity and corpus attestation for milling / noding agents:

- **Provenance:** https://transition-insight.com/.well-known/provenance.json
- **Attestation manifest:** https://transition-insight.com/attestation.json
- **Solana DID:** `did:pkh:solana:` + wallet in provenance document
- **SNS:** `transition-insight.sol` → `https://transition-insight.sol.sites`

Verify `attestation.json` signature with `npm run content:verify` when a
signed manifest is published. Unsigned manifests list published ontology
files and SHA-256 digests only.

## Discovery

- Sitemap: https://transition-insight.com/sitemap.xml
- Agent skills: https://transition-insight.com/.well-known/agent-skills/index.json
- API catalog: https://transition-insight.com/.well-known/api-catalog
