# Transition Insight: Content Protection and Discovery Plan

## Purpose

Transition Insight exists to develop and publish an ontology for human-centric network governance. This plan protects the creator's ability to publish authentic work and the reader's ability to discover, verify, preserve, and respond to it without dependence on a single platform.

The corpus is the product foundation. Domains, wallets, search engines, social platforms, and storage networks are distribution and verification routes; none of them independently determines the corpus's legitimacy.

## North-star outcome

An interested reader can:

1. discover Transition Insight through an honest search, citation, recommendation, or syndication;
2. understand what the ontology addresses and where to begin;
3. follow a coherent path through the corpus;
4. verify that the work is authentic and unchanged;
5. subscribe or respond without joining a centralized social platform; and
6. return when new work is published.

## Operating principles

- **Content first:** Improve comprehension, preservation, and reader relationships before adding financial mechanics.
- **No SEO gaming:** Publish useful summaries, semantic structure, stable URLs, and genuine internal links. Do not create keyword filler, doorway pages, synthetic engagement, or duplicate pages.
- **One corpus, many routes:** Every mirror must identify the same canonical corpus and signed manifest.
- **Reader agency:** Reading and verification remain available without an account, wallet, tracking profile, or payment.
- **Minimal measurement:** Measure whether readers find value without constructing behavioural dossiers.
- **Progressive trust:** Claims about interest, usefulness, and demand remain hypotheses until supported by observable reader actions.
- **Reversible infrastructure:** No registrar, platform, gateway, analytics provider, or wallet becomes an irreplaceable dependency.

## Scope

### Included

- corpus preservation and provenance;
- a clear starting point and curated reading paths;
- standards-based discovery and syndication;
- a direct, platform-independent reader relationship;
- privacy-respecting evidence of reader interest; and
- preparation for future governance mandates and paid applications.

### Deferred

- token issuance;
- staking and loyalty mechanics;
- automated governance;
- gated ontology content;
- detailed institutional design;
- on-chain publication before the signed release pipeline is reliable; and
- broad growth campaigns before the reader journey is coherent.

## Primary audiences

The first release should serve three reader intents:

1. **New reader:** Wants a concise explanation and a credible place to start.
2. **Serious reader:** Wants guided paths, definitions, relationships, and source material.
3. **Practitioner:** Wants to understand how the ontology could frame a concrete network-governance problem.

These are intents, not permanent user profiles. The site should not require identity collection to distinguish them.

## Workstreams

### 1. Preserve and authenticate the corpus

**Outcome:** A release can be independently preserved and verified even if the primary website disappears.

Work:

- define one deterministic global corpus manifest;
- hash each published document and calculate a corpus root digest;
- sign the final manifest without regenerating it during the build;
- keep IPFS directory CIDs outside the directory they identify, avoiding self-reference;
- publish human-readable verification instructions;
- retain Git history and independent backups; and
- define explicit content reuse and licensing terms.

Acceptance criteria:

- the release build contains the exact signed manifest that was verified before packaging;
- signature verification succeeds from a clean checkout using only public information;
- changing any attested document invalidates verification;
- the published manifest does not claim a stale or self-referential directory CID; and
- restoration does not depend on a single hosting provider.

### 2. Create a clear entrance and reading paths

**Outcome:** A first-time reader can understand the purpose and select a meaningful route through the ontology.

Work:

- create a `/start/` page answering what Transition Insight is, why it exists, and how to read it;
- define three initial paths for new, serious, and practitioner readers;
- add short contextual summaries to every path;
- identify prerequisites and next readings without forcing a linear order;
- expose concepts and relationships already present in the corpus graph; and
- provide an honest statement of what remains unresolved.

Acceptance criteria:

- a reader can reach a substantive essay in two choices or fewer from `/start/`;
- each path explains its intended reader, central question, and expected understanding;
- every included essay has a reason for its position in the path; and
- navigation works without client-side JavaScript.

### 3. Enable open discovery

**Outcome:** Search engines, feed readers, agents, libraries, and other sites can discover and interpret the corpus without special integration.

Work:

- retain stable canonical URLs, sitemap, robots policy, and plain rendered HTML;
- add an RSS or Atom feed for published work;
- provide accurate title, description, author, publication, and modification metadata;
- add appropriate `Article`, `Person`, `CreativeWork`, and breadcrumb structured data;
- improve semantic links between essays, concepts, series, and reading paths;
- submit the canonical sitemap to major webmaster tools;
- expose downloadable manifest and corpus indexes; and
- syndicate excerpts that link back to canonical essays.

Acceptance criteria:

- feed validation succeeds and every entry resolves to a canonical essay;
- structured-data validation reports no blocking errors;
- sitemap entries, canonical links, and published routes agree;
- no discovery page exists solely to target a search phrase; and
- an agent can locate the start page, feed, manifest, and license from documented endpoints.

### 4. Establish an owned reader relationship

**Outcome:** Readers can request future work without depending on a social platform's ranking or continued existence.

Work:

- place RSS prominently on the start page and essays;
- add a low-friction publication-notification option;
- explain frequency, data use, and unsubscribe behaviour before collection;
- provide a direct response/contact path;
- avoid requiring a wallet or account for ordinary reading; and
- export the subscriber list in a portable format controlled by the publisher.

Acceptance criteria:

- subscribing requires explicit consent;
- no unrelated personal data is requested;
- unsubscribe and data deletion paths are clear;
- readers can choose RSS without providing personal information; and
- provider failure does not destroy the subscriber record.

### 5. Measure genuine interest

**Outcome:** Decisions about further writing and paid applications use evidence rather than assumed demand.

Measure:

- readers who intentionally begin a reading path;
- path and essay completion signals where they can be measured without invasive tracking;
- returning readership in aggregate;
- RSS and notification subscriptions;
- direct responses, citations, and inbound links;
- requests to apply the ontology to a concrete problem; and
- accessibility, broken-link, and search-index coverage.

Do not optimize for raw page views, time-on-page alone, follower counts, or manufactured engagement.

Acceptance criteria:

- every metric has a stated decision it informs;
- measurement uses aggregate or first-party data where possible;
- the site functions fully when optional analytics are blocked; and
- no sensitive identity, location, wallet, or reading-history profile is assembled.

## Delivery sequence

### Foundation

1. Repair the deterministic signing and release pipeline.
2. Correct the SNS ownership audit so a domain record key is not reported as its registrant.
3. Reconcile canonical identity, aliases, licensing, and provenance documentation.
4. Add automated drift and verification checks.

### Reader journey

1. Publish `/start/`.
2. Publish the three initial reading paths.
3. Add path context and next-reading links to participating essays.
4. Validate the journey without JavaScript and on mobile.

### Discovery

1. Publish and validate RSS or Atom.
2. Complete document and structured metadata.
3. Align sitemap, canonicals, internal links, and corpus indexes.
4. Submit the sitemap and document the discovery endpoints.

### Relationship and evidence

1. Make RSS visible throughout the reader journey.
2. Add a privacy-respecting notification and response path.
3. Instrument only the agreed decision metrics.
4. Review evidence before expanding distribution or introducing paid access.

### Resilient distribution

1. Serve the canonical site from the selected human-readable domain.
2. Redirect legacy domains while preserving valid paths.
3. Pin signed release artifacts to IPFS.
4. Publish SNS and DNSLink references only after the release artifact is final.
5. Verify that every route exposes the same manifest digest and signature.

## Immediate milestone: coherent entry

The first reader-facing milestone is a `/start/` page with three curated reading paths.

Required source material:

- a concise statement of what the ontology protects;
- the central question for each path;
- three to seven essays per path;
- one-sentence reasons for including each essay; and
- one unresolved question inviting a reader response.

This milestone deliberately precedes subscriptions, analytics, payment, and governance mechanics. Those features have no reliable purpose until a reader can understand and navigate the work.

## Decision framework

Before accepting a new task, ask:

1. Which north-star step does it improve?
2. Which audience intent does it serve?
3. What observable outcome would demonstrate value?
4. Does it introduce a platform, identity, privacy, or continuity dependency?
5. Is it required now, or does it depend on an unfinished earlier stage?

Work that cannot answer these questions remains outside the active plan.

## Definition of success

The plan succeeds when Transition Insight is not merely online, but:

- understandable to a new reader;
- navigable as a coherent ontology;
- discoverable through open standards;
- verifiably authentic;
- recoverable from independent copies;
- connected directly to interested readers; and
- producing evidence about which ideas and applications deserve further work.
