---
name: agentic-payments
description: >
  How an agent should reason about paying, or getting paid, on someone's behalf:
  which autonomy stage applies, which payment journey fits, what mandate (budget,
  limits, allowlist) must exist, how credentials and agent identity are handled,
  and when to stop and hand back to the human. Use when designing, reviewing, or
  executing any agent-initiated payment flow in this app, or when mapping one onto
  ISO 20022 rails. Not for essay drafting.
---

# Agentic payments

Distilled from Visa Consulting & Analytics, *The Rise of Agentic Commerce, Part 1:
New payment journeys and nascent paradigms* (2025). The source PDF sits locally in
`.refs/agentic/visa-rise-of-agentic-commerce-pt1.pdf`; it is gitignored and is not shipped.
The four-stage model, the three journey types, the control types and the three
primitives come from the paper. The ISO 20022 bridge at the end is ours, not Visa's.

## The one idea

Today's payment stack assumes a human is behind the screen. An agent payment has to
prove something different: not "I am the right human" but "I am the authorised agent
acting for the right human, inside limits that human set." Everything below exists
to make that claim checkable.

## 1. Classify the autonomy stage

Before doing anything, decide which stage the task is in. Never act above the stage
the user has granted.

| Stage | What the agent may do | Human role |
|---|---|---|
| **Recommends** | Compare, suggest, link out. No money moves. | Does everything else |
| **Initiates** | Drive the journey up to checkout. | Confirms and authorises every payment |
| **Transacts** | Complete low-risk payments end to end within preset limits. | Sets limits up front, approves anything outside them |
| **Orchestrates** | Plan and run multi-step, multi-merchant workflows on a budget; may hold an ongoing role (e.g. a supply or customer-success agent). | Sets budget and role, audits, handles exceptions |

Default to **Recommends** when nothing says otherwise. Autonomy is earned by proving
reliability on lower-risk work first.

## 2. Pick the payment journey

| Journey | How money moves | Use when | Watch for |
|---|---|---|---|
| **Browser automation** | Agent navigates a human checkout; the user types card details in a private session the agent can't see. | No API exists | Brittle; scraping and cookies raise privacy and consent issues; some places require the human to accept terms |
| **Integrated tool / plugin** | Agent calls the merchant's or software provider's API; the merchant's own processor charges a card or token already on file. | Merchant has an integration | Experience varies across merchants; strong authentication may still be needed |
| **Platform as wallet** | User pays the platform; the platform pays the merchant in a second transaction (marketplace / travel-agency model), using closed loop, B2B virtual cards, bank transfer schemes, or push-to-card. | Platform aggregates many sellers or paid services, including other agents | The platform now custodies funds and credentials and carries that regulatory weight |

From **Transacts** onward the paper expects a shift from that staged-wallet model
toward pass-through: the user's tokenised credential goes straight to the merchant,
who processes it normally.

## 3. Require a mandate before any money moves

An agent that pays needs three things, and should refuse to pay without all three:

1. **A budget.** Either permissioned access to a prefunded wallet, or a tokenised
   credential with limits attached.
2. **Credentials it can use but not expose.** Prefer tokens bound to this agent and
   device over raw card or account numbers. The user must be able to update, revoke
   and reactivate them, and see where they are stored.
3. **An identity of its own.** A cryptographically secure agent ID tied to its
   permission set, with an unambiguous, revocable link to the person or company it
   acts for.

### Controls the mandate should carry

- **Spend thresholds**: per transaction and per day.
- **Velocity**: a maximum number of payments per run.
- **Allowlist**: the merchants, services, apps or APIs the agent may pay.
- **Single-use virtual cards** with their own limits and merchant restrictions, where available.

### Where the controls live

- **Workflow-level**: set fresh for each task. Best for ad hoc or complex jobs. The
  risk is contained to that one run.
- **Agent- or profile-level**: standing rules. Agent-level limits cover everything
  one agent does; profile-level limits cover every agent the user runs on a platform.
  Best for repeat tasks.
- Expect both at once. When they disagree, the stricter rule wins.

## 4. Run the plan-then-pay loop

1. Restate the goal and the mandate that applies.
2. Present an **execution plan**: the steps, the expected spend per step, which
   credential or budget pays for each, and what could go wrong.
3. Get the plan approved. The user can edit it.
4. Execute. Payments inside the limits go through. Anything outside them is **held**
   pending the user's confirmation, never retried around the limit.
5. Show every payment transparently afterwards: what, to whom, how much, under which rule.

## 5. Always stop and hand back when

- The amount or merchant is outside the mandate.
- The transaction is high value or otherwise risky.
- A regulator-mandated authentication step is triggered (for example strong customer
  authentication, two of knowledge, possession, inherence).
- The site demands the human personally accept terms.
- Anything about the agent's own identity or token can't be verified.

## 6. Trust signals worth recording

So disputes and fraud checks can compare what happened against what the user wanted,
keep, per payment: the user's original instruction, the approved plan, the mandate
version in force, the agent ID, the token used, and the outcome. Liability rules for
agent payments are still being written, so this record is the evidence.

## 7. ISO 20022 bridge (ours, not from the paper)

Use with the `iso20022-e-repository` skill to check element names against the local
Data Dictionary before emitting anything.

| Agent concept | Where it plausibly lands |
|---|---|
| The human the agent acts for | Debtor (or Ultimate Debtor when a platform pays on their behalf) |
| The agent or AI platform that starts the payment | Initiating Party in the `pain.001` group header |
| The payee | Creditor / Ultimate Creditor |
| One end-to-end payment across every hop | UETR, which is also the anchor for the trust record in section 6 |
| Why the payment was made (task, plan step) | Purpose code plus remittance information |
| Approved, held, or rejected | Status reports (`pain.002`) |
| Reconciliation after settlement | Debit and credit notifications (`camt.054`) |

Treat this table as a starting hypothesis. The paper is card-network centric; bank
rails and settlement finality are a separate question.

## Rules of use

1. Never move money at a stage higher than the one the user granted.
2. No mandate, no payment.
3. Held is a final answer until the human acts. Do not split, rephrase or reroute a
   payment to get under a limit.
4. Don't quote the paper's statistics as current fact; they date from mid-2025 and
   come from Visa's own surveys.
