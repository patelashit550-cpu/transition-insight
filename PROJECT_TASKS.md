# Transition Insight: Delivery Task Register

This register turns [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) into specific, owned work. It is the operational backlog for the project.

## How to use this register

### Owners

- **Ashit:** Requires authorship, account access, custody, payment, or a value judgment that should not be delegated.
- **Agent:** Can be implemented and verified autonomously in the repository or with already-authorized tools.
- **Shared:** Ashit supplies a decision or source material; the Agent structures, implements, and verifies it.

### Status

- **Ready:** All dependencies are satisfied.
- **Blocked:** A listed dependency or external action is outstanding.
- **Later:** Deliberately deferred by the project plan.
- **Done:** Acceptance evidence has been recorded.

### Completion rule

A task is not done because code or prose exists. It is done when its acceptance check passes and durable evidence is available in the repository, CI, published site, or relevant provider.

## Active queue

Work should proceed in this order unless a newly discovered risk changes a dependency:

1. `F-01` through `F-06`: make the corpus release deterministic and verifiable.
2. `F-07` through `F-12`: reconcile identity, licensing, and drift checks.
3. `R-01` through `R-08`: publish a coherent entrance and reading paths.
4. `D-01` through `D-10`: enable standards-based discovery.
5. `O-01` through `O-08`: establish an owned reader relationship.
6. `M-01` through `M-07`: measure genuine interest.
7. `X-01` through `X-10`: publish resilient, equivalent routes.

Cost controls in `C-01` through `C-09` apply throughout.

## Foundation: preserve and authenticate the corpus

| ID | Owner | Status | Task | Depends on | Acceptance evidence |
|---|---|---|---|---|---|
| `F-01` | Agent | Ready | Separate manifest generation, signing, packaging, and pinning into explicit commands. | — | Each command has one responsibility and automated tests cover command order. |
| `F-02` | Agent | Blocked | Make production builds preserve an existing valid signature instead of regenerating an unsigned attestation. | `F-01` | A signed fixture remains byte-for-byte identical in the final export. |
| `F-03` | Agent | Blocked | Make builds fail clearly when a required production signature is absent, stale, or made by the wrong public key. | `F-01` | Negative tests cover missing, stale, malformed, and wrong-key signatures. |
| `F-04` | Agent | Blocked | Remove the self-referential CID workflow; keep the final directory CID in DNS, SNS, IPNS, or detached release metadata. | `F-01` | No build instruction asks for a CID to be embedded into the directory identified by that CID. |
| `F-05` | Agent | Blocked | Add a clean-checkout verification command for document hashes, corpus digest, signer, and exported manifest. | `F-02`, `F-03` | Verification succeeds from a clean checkout and fails after a one-byte document change. |
| `F-06` | Shared | Blocked | Exercise the final signing workflow without exposing the signing secret. | `F-02`, `L-01` | Public signature verifies against the intended key; no seed or secret appears in Git, logs, shell history, or chat. |
| `F-07` | Agent | Ready | Correct the SNS audit so a domain record key is not reported as the registrant wallet. | — | Live portfolio ownership and audit output agree for `transition-insight.sol`. |
| `F-08` | Ashit | Ready | Choose permanent roles for `.com`, `.xyz`, `.sol`, and `.sol.site`: canonical, redirect, identity, and immutable mirror. | — | One written decision names exactly one human-facing canonical and the role of every alias. |
| `F-09` | Agent | Blocked | Apply the domain-role decision consistently to constants, environment examples, metadata, sitemap, OpenAPI, provenance, security notes, and skills. | `F-08` | Automated search and tests find no contradictory canonical-domain claims. |
| `F-10` | Ashit | Ready | Select the corpus reuse license and decide whether commercial use requires separate permission. | — | License name, version, permitted reuse, attribution, derivatives, and commercial terms are explicit. |
| `F-11` | Agent | Blocked | Publish the selected license in the repository, site metadata, downloadable corpus, and human-readable provenance guidance. | `F-10` | A reader and an agent can locate the same license from documented public endpoints. |
| `F-12` | Agent | Blocked | Add CI drift checks for canonical URL, aliases, wallet, DID, manifest digest, signature, routes, and license. | `F-05`, `F-09`, `F-11` | CI fails on a controlled mismatch and passes on the reconciled repository. |
| `F-13` | Ashit | Ready | Confirm that source, local working copy, and signing material have independent recovery paths. | — | Recovery locations and responsible custodian are documented privately; no secret is committed. |
| `F-14` | Agent | Blocked | Write a public restoration and verification runbook that requires no private information. | `F-05`, `F-11` | A fresh machine can retrieve and verify a release using the runbook. |

## Ledger and signing compatibility

| ID | Owner | Status | Task | Depends on | Acceptance evidence |
|---|---|---|---|---|---|
| `L-01` | Shared | Ready | Record a signer inventory: Nano S, Nano X, mobile wallet, Phantom account, public keys, supported connection path, and exact errors. Never record seeds. | — | Inventory identifies which device can authorize each public key and transaction type. |
| `L-02` | Agent | Blocked | Introduce a signer interface that does not assume an exportable raw secret. | `F-01`, `L-01` | Manifest signing accepts a replaceable signer implementation and verification remains implementation-independent. |
| `L-03` | Agent | Blocked | Add safe support for a local keypair path for development and recovery testing. | `L-02` | Tests use temporary fixtures; production instructions never request a seed phrase. |
| `L-04` | Agent | Blocked | Research and prototype Ledger-compatible off-chain signing through supported Solana/Ledger tooling. | `L-01`, `L-02` | A documented capability matrix distinguishes message signing, transaction signing, Windows, WSL, Nano S, and Nano X. |
| `L-05` | Agent | Blocked | Add a read-only Windows diagnostic for device visibility, Solana app state, public-key derivation, and competing Ledger Live/browser sessions. | `L-01` | Diagnostic changes no device or chain state and produces actionable, secret-free output. |
| `L-06` | Ashit | Blocked | Run the diagnostic once per available Ledger/device path and return only public output and exact errors. | `L-05` | Nano S, Nano X, native Windows, mobile, and any WSL path used are individually recorded. |
| `L-07` | Shared | Later | Decide whether routine manifests use the root wallet directly or a root-signed, revocable operational delegation. | `L-04` | Threat model, rotation, expiry, revocation, and recovery are explicit. |

## Reader journey: coherent entrance and reading paths

| ID | Owner | Status | Task | Depends on | Acceptance evidence |
|---|---|---|---|---|---|
| `R-01` | Ashit | Ready | Write a concise answer to “What must this ontology protect?” | — | One paragraph is understandable without prior knowledge of the corpus. |
| `R-02` | Ashit | Ready | Write a concise answer to “Who is it for?” without defining a permanent user profile. | — | The answer names reader situations and needs rather than demographic targeting. |
| `R-03` | Ashit | Ready | Write “What must this network never become?” | — | The answer establishes enforceable boundaries against surveillance, coercion, and concentrated control. |
| `R-04` | Ashit | Ready | Select three to seven essays for the **new reader** path and give one sentence explaining each inclusion. | — | The path has a central question, deliberate order, and explicit endpoint. |
| `R-05` | Ashit | Ready | Select three to seven essays for the **serious reader** path and give one sentence explaining each inclusion. | — | The path exposes conceptual dependencies and unresolved tensions. |
| `R-06` | Ashit | Ready | Select three to seven essays for the **practitioner** path and give one sentence explaining each inclusion. | — | The path ends in a concrete governance problem or mandate. |
| `R-07` | Agent | Blocked | Convert `R-01` through `R-06` into a typed reading-path content model and `/start/` page. | `R-01`–`R-06` | All three paths render from structured source data with stable links. |
| `R-08` | Agent | Blocked | Add path context, prerequisites, next-reading links, and unresolved questions to participating essays. | `R-07` | Every path item explains why it follows and where the reader may go next. |
| `R-09` | Agent | Blocked | Validate `/start/` and paths without client-side JavaScript, on mobile, and with keyboard/screen-reader navigation. | `R-08` | Automated checks pass and walkthrough evidence covers the three journeys. |

## Discovery: standards, metadata, and syndication

| ID | Owner | Status | Task | Depends on | Acceptance evidence |
|---|---|---|---|---|---|
| `D-01` | Agent | Blocked | Inventory current titles, descriptions, authors, publication dates, modification dates, canonicals, and structured data. | `F-09` | Report identifies every missing, conflicting, or inferred field. |
| `D-02` | Ashit | Blocked | Supply or approve missing human-authored descriptions, dates, and author attributions. | `D-01` | Every published essay has approved descriptive metadata. |
| `D-03` | Agent | Blocked | Implement and validate an Atom feed for published corpus entries. | `D-02` | Feed validates, uses canonical essay URLs, and orders entries deterministically. |
| `D-04` | Agent | Blocked | Add feed discovery links to HTML metadata, `/start/`, and essay layouts. | `D-03`, `R-07` | Browsers and feed readers discover the feed automatically. |
| `D-05` | Agent | Blocked | Implement appropriate `Article`, `Person`, `CreativeWork`, and breadcrumb JSON-LD. | `D-02` | Structured-data validation has no blocking errors and matches visible content. |
| `D-06` | Shared | Blocked | Identify meaningful conceptual links between path essays; reject keyword-only links. | `R-08` | Each new link has an explicit reader benefit and no synthetic anchor text. |
| `D-07` | Agent | Blocked | Align sitemap, canonical links, published routes, feed entries, and corpus indexes. | `D-03`, `D-05`, `F-09` | Automated cross-check reports no missing or contradictory URLs. |
| `D-08` | Ashit | Blocked | Submit the canonical sitemap to Google Search Console and Bing Webmaster Tools. | `D-07`, `X-04` | Both providers report successful retrieval; account credentials remain private. |
| `D-09` | Agent | Blocked | Publish documented, downloadable manifest and corpus indexes for humans and agents. | `F-05`, `F-11` | Files are linked from public documentation and resolve without authentication. |
| `D-10` | Ashit | Blocked | Choose initial syndication channels and write excerpts in the original voice. | `R-07`, `D-07` | Every excerpt provides standalone value and links to one canonical essay. |

## Owned reader relationship

| ID | Owner | Status | Task | Depends on | Acceptance evidence |
|---|---|---|---|---|---|
| `O-01` | Ashit | Blocked | Decide whether the first notification channel is email, RSS-only, or both. | `D-03` | Decision states what information is collected and why. |
| `O-02` | Agent | Blocked | Compare minimal notification providers for consent, export, deletion, cost, portability, and static-site integration. | `O-01` | Decision record recommends one provider and a provider-exit path. |
| `O-03` | Shared | Blocked | Write notification frequency, privacy, unsubscribe, and data-use copy. | `O-02` | Copy is specific, concise, and consistent with actual provider behaviour. |
| `O-04` | Agent | Blocked | Implement the notification entry point without gating ordinary reading. | `O-03`, `R-07` | Consent is explicit, errors recover gracefully, and the site works when the provider is blocked. |
| `O-05` | Ashit | Ready | Choose the public response channel and boundaries for expected replies. | — | A reader knows where to respond and what response, if any, to expect. |
| `O-06` | Agent | Blocked | Add the response path to `/start/`, essays, feed metadata where appropriate, and provenance guidance. | `O-05`, `R-07` | Contact details are consistent and protected from obvious automated abuse. |
| `O-07` | Agent | Blocked | Document subscriber export, deletion, provider migration, and recovery. | `O-02` | A provider can be replaced without losing consent records or silently changing terms. |
| `O-08` | Ashit | Blocked | Perform the first subscriber export and store it in an encrypted, private recovery location. | `O-07` | Export can be restored; no subscriber data enters Git. |

## Evidence of genuine interest

| ID | Owner | Status | Task | Depends on | Acceptance evidence |
|---|---|---|---|---|---|
| `M-01` | Shared | Blocked | For each proposed metric, state the decision it will inform. | `R-07`, `O-01` | Metrics without a decision are removed. |
| `M-02` | Agent | Blocked | Design a privacy-respecting event taxonomy for path starts, completions, subscriptions, responses, citations, and failures. | `M-01` | Taxonomy contains no sensitive identity, wallet, precise location, or cross-site profile. |
| `M-03` | Agent | Blocked | Compare first-party or aggregate measurement options for privacy, cost, export, and static-site compatibility. | `M-02` | Decision record recommends the minimum viable measurement approach. |
| `M-04` | Agent | Blocked | Implement only approved events with analytics remaining optional. | `M-03` | Blocking analytics does not impair reading, navigation, feeds, or verification. |
| `M-05` | Agent | Blocked | Add automated checks for broken links, accessibility, feed health, sitemap coverage, and structured metadata. | `D-07`, `R-09` | Checks run in CI and identify a controlled failure. |
| `M-06` | Ashit | Blocked | Review aggregate evidence and reader responses against the decisions in `M-01`. | `M-04`, `M-05` | Written review records what to continue, stop, or investigate. |
| `M-07` | Shared | Blocked | Define the first paid governance mandate only after reader evidence identifies a concrete application. | `M-06` | Mandate names payer, problem, inputs, node work, artifact, acceptance, payment, and stake conditions. |

## Resilient distribution and domain alignment

| ID | Owner | Status | Task | Depends on | Acceptance evidence |
|---|---|---|---|---|---|
| `X-01` | Ashit | Blocked | Supply Cloudflare access through OAuth or a least-privilege token; never share it in chat or Git. | `F-08` | Agent can read the intended zone without gaining unrelated account access. |
| `X-02` | Agent | Blocked | Inventory `.com`, `www`, `.xyz`, `.sol`, and `.sol.site` DNS, TLS, redirects, and live content. | `X-01` | Report distinguishes registrar, authoritative DNS, hosting, gateway, and application responsibilities. |
| `X-03` | Agent | Blocked | Produce an exact, reversible DNS and redirect change set matching the domain-role decision. | `X-02` | Change preview names every record/rule, expected response, rollback, and propagation check. |
| `X-04` | Shared | Blocked | Apply and verify the selected human-facing canonical domain. | `F-09`, `X-03` | Canonical host serves valid TLS and the expected release at root and representative deep links. |
| `X-05` | Agent | Blocked | Configure legacy-domain redirects preserving valid paths and query strings. | `X-04` | HTTP tests confirm one-hop permanent redirects without loops. |
| `X-06` | Ashit | Blocked | Configure Pinata or local Kubo credentials privately. | `F-05` | A read-only identity/status check succeeds; secrets remain outside Git and chat. |
| `X-07` | Shared | Blocked | Pin the final signed export exactly once and record its CID outside the directory. | `F-06`, `X-06` | Retrieved CID content reproduces the packaged files and verifies successfully. |
| `X-08` | Ashit | Blocked | Approve SNS `SOL`, `IPFS`, CNAME, and `_dnslink` transactions from the controlling wallet when funds and signing access are ready. | `X-07`, `L-01` | On-chain records match the approved public key and final CID; URL record does not override IPFS. |
| `X-09` | Agent | Blocked | Verify `.sol.site` DNS, TLS, CID resolution, manifest digest, and signature after propagation. | `X-08` | `.sol.site` serves the same verified release as the canonical route. |
| `X-10` | Agent | Blocked | Add an equivalence check across every public route. | `X-04`, `X-05`, `X-09` | Scheduled or release-time check confirms matching digest/signature and reports drift. |

## Cost controls for Cursor-assisted work

These controls reduce avoidable usage without weakening the published software. Account and Windows Desktop settings require Ashit; a repository/cloud agent cannot alter them remotely.

| ID | Owner | Status | Task | Depends on | Acceptance evidence |
|---|---|---|---|---|---|
| `C-01` | Ashit | Ready | Open Cursor Dashboard → **Spending** and either disable on-demand usage or set a small explicit monthly limit. | — | Dashboard shows the intended hard limit; alerts alone do not count as a cap. |
| `C-02` | Ashit | Ready | Set routine Desktop work to `Composer 2.5`, or `Auto → Cost` when Cursor Router is available. | — | Model selector shows the chosen economical default. |
| `C-03` | Ashit | Ready | Keep Max Mode off unless a specific task requires unusually large context and justifies its cost. | — | Max Mode is disabled for routine chats. |
| `C-04` | Ashit | Ready | In Dashboard → Cloud Agents, choose an economical default model for new agents. | — | New-agent default no longer selects a frontier model automatically. |
| `C-05` | Ashit | Ready | In Cloud Agents → My Settings, disable automatic CI fixes unless unattended repair is intentionally desired. | — | Automatic follow-up turns are off or explicitly justified. |
| `C-06` | Ashit | Ready | Reduce enabled MCP servers to the three-to-five services needed for current work; delete unused personal entries when at the 50-server limit. | — | Active MCP list is small enough to identify every server's purpose. |
| `C-07` | Agent | Ready | Use direct tools for narrow questions and reserve subagents for broad exploration, non-trivial debugging, or required UI testing. | — | Task summaries identify delegated work only when it materially reduced risk or latency. |
| `C-08` | Agent | Ready | Batch independent reads and checks, avoid duplicate builds, and run verification proportional to change risk. | — | Each change reports a concise test plan and no redundant long-running jobs. |
| `C-09` | Shared | Ready | Review Cursor model/pool usage after a representative work cycle and adjust the default or cap using actual spend. | `C-01`–`C-08` | Decision uses Dashboard usage evidence rather than assumptions about per-server or per-message cost. |

## Immediate assignments

### Ashit

1. Complete `R-01`, `R-02`, and `R-03` in rough language; polish is not required.
2. Begin `R-04` by selecting the new-reader essays.
3. Decide `F-08`: the permanent role of each domain.
4. Decide `F-10`: the intended reuse and commercial-use boundary.
5. Apply `C-01` through `C-06` in Cursor/account settings.

### Agent

1. Implement `F-01` through `F-05`.
2. Implement `F-07`.
3. Prepare `L-01` as a safe inventory template and `L-02` as the signing abstraction.
4. Keep this register synchronized as tasks close or dependencies change.

### Shared checkpoint

Do not begin the `/start/` implementation until Ashit's three protection statements and initial essay selections exist. Do not publish an IPFS/SNS reference until the signed release pipeline passes `F-01` through `F-06`.
