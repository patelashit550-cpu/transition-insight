---
stage: draft
node_id: 2921
jurisdiction: Ashit Milne
title: Why PoS
label: Why PoS
type: essay
theme: emerald
size: md
showInNav: false
---
### 1. Why PoS is the Right Rail

- **Micro-settlement:** Finality within seconds, fees measured in fractions of a cent.
- **Energy-light:** The environmental footprint aligns with your *sovereign stewardship* ethic.
- **Native staking yield:** Can fund your baseline UBI pool (staking income = communal endowment).
- **Programmability:** Smart-contract logic to express your PV/FV differentials directly on-chain.

------

### 2. Practical Design Pattern

1. **Vault → Chain Interface:**
   - Each citizen’s *Stone Rose* identity links to a self-custodied address.
   - Their *Redcurrant* data feed is hashed, not published; only state proofs or aggregates touch the chain.
2. **Oracle / Compute Layer:**
   - Off-chain engine calculates ∆V and SQI.
   - Sends signed state updates to the smart contract through an oracle.
3. **Streaming Mechanism:**
   - Use continuous-payment protocols such as **Superfluid**, **Sablier**, or **LlamaPay**.
   - Citizens receive “micro-dividends” or deductions minute-by-minute according to SQI deltas.
4. **Token Economics:**
   - xxxxxBase token: staking asset of the PoS chain (e.g., SOL, ATOM, or ETH).
   - *Regnum*-specific stable or derivative token: represents the UBI differential.
   - Treasury stakes reserves → staking rewards top up the UBI pool → virtuous cycle.

------

### 3. Candidate Chains (illustrative)

| Chain                 | Strength                            | Why it fits                                     |
| --------------------- | ----------------------------------- | ----------------------------------------------- |
| **Solana**            | sub-cent fees, real-time streams    | perfect for continuous micro-payouts            |
| **Polygon / zkEVM**   | EVM compatibility                   | easy integration with existing ReFi tools       |
| **Cosmos / Celestia** | modular sovereignty                 | good for a “city-state” or jurisdictional pilot |
| **NEAR**              | account abstraction, human-readable | simplifies citizen onboarding                   |

You’d pick one based on your comfort with tooling and the level of decentralization you require.

------

### 4. Governance / Security Notes

- Staking weight = “capital” pillar of *Regnum Dei*.
- Validator sets act as the “intelligence” and “law” layer: securing consensus while enforcing data-integrity proofs.
- Slashing or reward parameters can include *ethical clauses*—if an oracle misreports, stake is burned and redistributed.

------

### 5. Immediate Next Step

Prototype a **micro-UBI stream on a testnet** (e.g., Polygon Amoy + Superfluid).
 You’ll see exactly how negligible the cost is: a continuous payment every few seconds, total gas well under one U.S. cent per day per user.
