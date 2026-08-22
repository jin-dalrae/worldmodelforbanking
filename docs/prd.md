# PRD: World Model for Banking — Demo

| Field | Value |
| --- | --- |
| Product | World Model for Banking (repo: `worldmodelforbanking`) |
| Document type | Product Requirements Document |
| Status | Draft |
| Date | 2026-08-22 |
| Author | Product & Engineering |
| Audience | CRO, Head of Credit/Cards, Fraud/AML, Model Risk, Decision Science |

---

## 1. Problem statement

Capital-markets “world models” simulate stochastic price paths, limit order books, and liquidity microstructure. That machinery is the wrong physics for a card or deposit book.

Retail banking is a generative process over **people**, **cash-flow**, and **multi-party payment networks**. The state moves in irregular events (paycheck, rent ACH, grocery swipe, decline). Payoffs are delayed (defaults emerge over 90–180 days; churn is gradual). Agents are habit-driven and boundedly rational, not latency-sensitive profit maximizers.

Today’s stack cannot answer the question a credit executive actually asks:

> If we cut this cohort’s credit line by 20% during an inflationary spike, how do default rates, spending displacement, and deposit retention change over 18 months?

| Current tool | What it does | Why it fails this job |
| --- | --- | --- |
| Bureau scorecards / PD-LGD-EAD | Point-in-time risk given features | No transition dynamics, no policy counterfactual, no spend/deposit side effects |
| Champion/challenger tests | Live A/B on a thin action | Slow, expensive, ethically and reputationally constrained; cannot test recessions |
| Monte Carlo credit models | Sample from calibrated PD/LGD | Independent draws; no household cash engine; no merchant substitution |
| Brokerage world models | Prices, order books, impact | Wrong state, wrong agents, wrong graphs, wrong timescale |

World Model for Banking is a **generative simulator of the financial lifecycle**: a world model whose state is household liquidity, whose actions are issuer policies, and whose rewards are NIM, interchange, losses, churn, and LTV.

---

## 2. Vision & product thesis

**Thesis.** A bank that can simulate household physics can change credit lines, APRs, rewards, and hardship timing the way a market-maker changes quotes — with a model of what happens next — instead of waiting for charge-offs to print.

**Product.** A platform that (1) learns a latent state of consumers and accounts from transaction streams, (2) rolls that state forward under macro shocks and policy, and (3) scores interventions on risk-adjusted LTV subject to fairness, capital, and conduct constraints.

**V1 posture.** Decision-support simulation and synthetic data. Not a closed-loop production decisioning engine. RL policies may be trained offline; production rollout is a later, gated phase.

---

## 3. Personas & jobs-to-be-done

| Persona | Job | Success looks like |
| --- | --- | --- |
| Head of Credit / Card | Set lines and APRs under stress without torching spend or deposits | Counterfactual pack in hours, not a quarter |
| Stress-testing / MRM | CCAR-adjacent scenarios with explainable household mechanics | Traceable S→A→R paths, model card, challenger |
| Card product / rewards | Steer wallet share without inflating credit loss | Category-level spend response vs. loss |
| Fraud / AML science | Probe graph models on fraud-rich data without PII | Synthetic rings, structuring, mule paths |
| Decision-science platform | Host a sandbox for policy search | API + traces + constraint checker |

---

## 4. Goals & non-goals

### Goals

- Answer issuer-level counterfactuals over 12–24 months on default, spend displacement, deposits, NIM, interchange, churn, LTV.
- Keep idiosyncratic shocks aligned across policy arms (true counterfactuals, not two different random worlds).
- Emit synthetic event streams suitable for privacy-preserving development.
- Make the state/action/reward loop inspectable by model risk and line of business.
- Ship an interactive demo that runs the canonical 20% line-cut / inflation scenario in the browser.

### Non-goals (v1)

- Automated adverse-action or live underwriting.
- Capital-markets / brokerage microstructure.
- Full CCAR production model replacing the bank’s existing enterprise stress platform.
- Training on data that leaves the customer’s VPC.

---

## 5. World-model anatomy

```
State (S_t)                 Action / Policy (A_t)
• Cash buffers              • Credit limit changes
• Recurring burn            • APR adjustments
• Merchant graph            • Targeted incentives
• Macro climate             • Payment authorizations
              └──────┬──────┘
                     ▼
     Transition P(S_{t+1} | S_t, A_t)
     • Latent intent / consumption needs
     • Shock propagation (unemployment, inflation)
     • Competitor card substitution
                     ▼
     Next state S_{t+1} + Reward R_t
     • NIM  • Interchange  • Default/churn losses  • Customer LTV
```

### Banking vs. brokerage

| Dimension | Capital markets / brokerage | Retail banking & credit cards |
| --- | --- | --- |
| State dynamics | Fast, continuous prices and LOBs | Discrete, irregular event streams |
| Agent psychology | Profit-maximizing, game-theoretic | Habit-driven, boundedly rational |
| Feedback loop | Instantaneous clearing, price impact | Delayed: 90–180 day defaults; gradual churn |
| Graph topology | Asset correlation, cross-asset contagion | Bipartite consumers ↔ merchants; P2P |

### Building blocks

1. **Latent state** — sequence embeddings on `(timestamp, MCC, amount, merchant_id, balance_after)`; cash-flow velocity vs. non-discretionary burn; wallet hierarchy.
2. **Generative dynamics** — synthetic purchase/repay histories; microeconomic shocks; routing when a swipe is declined or a line is exhausted.
3. **Policy interventions** — real-time line management, pre-delinquency hardship, reward multipliers.

---

## 6. Use cases & acceptance criteria

**UC-1 Canonical counterfactual (P0).** User sets inflation, unemployment, and a −20% line cut. System compares baseline policy vs. intervention on the same households and shocks over 18 months. Acceptance: default rate, displaced spend, and deposit stock each move in a documented direction; household tape explains a sample of paths.

**UC-2 Stress testing (P0).** User specifies a stagflation path and reads capital-relevant loss and NIM. Acceptance: monthly 30+/90+ and charge-off curves exportable.

**UC-3 Offline policy search (P1).** Constraint-aware search over line/APR/hardship. Acceptance: no policy that breaches configured loss, fairness, or utilization caps is marked feasible.

**UC-4 Synthetic ledger (P0).** Export JSON/CSV of swipe, decline, payment events with MCC and amounts. Acceptance: no real PII; names are sampled labels.

**UC-5 Adversarial AML (P2).** Inject synthetic structuring rings into the merchant graph. Acceptance: a held-out rule engine misses at least one injected typology that the workbench flags.

---

## 7. Functional requirements

| ID | Pri | Requirement |
| --- | --- | --- |
| FR-001 | P0 | Shared-shock counterfactual engine (policy is the only arm difference) |
| FR-002 | P0 | Macro controls: inflation, unemployment, policy rate |
| FR-003 | P0 | Policy controls: limit Δ, APR Δ, cashback bps, hardship flag |
| FR-004 | P0 | Cohort filters (transactor, revolver, near-prime, subprime, gig) |
| FR-005 | P0 | Monthly series: spend, displacement, deposits, defaults, NIM, LTV, churn, utilization |
| FR-006 | P0 | Household narratives for tracked agents |
| FR-007 | P0 | Synthetic transaction export |
| FR-008 | P1 | Scenario save/load and shareable parameterization |
| FR-009 | P1 | Fairness constraint evaluator on policy search |
| FR-010 | P2 | Learned residual dynamics on top of the microsimulator |
| FR-011 | P2 | Bank-hosted connector for tokenized transaction streams |

---

## 8. Non-functional requirements

| ID | Target |
| --- | --- |
| NFR-001 | Interactive cohort of ≥1,000 households × 18 months × 2 arms in the browser < 200 ms on a modern laptop (demo) |
| NFR-002 | Platform: 1M accounts × 18 months × 100 paths overnight in a customer VPC |
| NFR-003 | Deterministic given seed |
| NFR-004 | Default deployment: data never leaves the customer’s control |
| NFR-005 | Audit log of scenario, seed, policy, and metric snapshot |
| NFR-006 | Model card + SR 11-7 artifact pack for the simulator |

---

## 9. State, action, reward (implementable)

**Time.** Event-driven household month with daily-ish tickets for tracked agents. Not HFT ticks.

**Observed state.** Income, cash, deposits, recurring burn, limit, balance, APR, wallet share, employment, delinquency days, default/churn flags, segment.

**Latent / demo-implied.** Risk residual, habit spend, substitution propensity. Production: transformer embedding over raw events.

**Actions.** `limitDelta`, `aprDelta`, `cashbackBps`, `hardship`. Later: authorization strategy, balance-transfer offers, category multipliers.

**Reward (monthly, then discounted at 12% annual):**

`R = NIM + interchange − charge-off − churn cost − cashback`

NIM = interest − (fed funds + 50 bps) × receivables. Interchange ≈ 1.8% of card spend. Recovery 18% at default.

---

## 10. Demo vs. platform

| Layer | This repository (demo) | Platform (subsequent PRs) |
| --- | --- | --- |
| Dynamics | Calibrated agent-based microsim, hash-seeded shocks | Microsim + learned residual / event generator |
| Data | Fully synthetic population | Bank-hosted tokenized streams |
| Interface | Single-page workbench | Scenario API, MRM console, policy search |
| Governance | Disclaimer + seed | Lineage, fairness gates, model cards |

The demo is the product’s proof of mechanism: the canonical counterfactual, inspectable household tape, and synthetic ledger.

---

## 11. Governance, privacy, fairness

- US-first: SR 11-7 / OCC MRM, ECOA/Reg B, GLBA, FCRA (bureau features), BSA/AML, CECL-adjacent stress. EU/UK hooks later.
- V1 does **not** issue credit decisions or adverse-action notices. Latent embeddings are not ECOA adverse-action reasons.
- Synthetic data must fail membership-inference tests against any training corpus used in later phases.
- Policy search must carry an explicit fairness constraint (to be chosen: demographic parity on line cuts vs. equalized odds on default — open question).

---

## 12. Success metrics

- Time-to-counterfactual for a card cohort (target: < 1 day internally; demo is instant).
- Directional calibration: sign of Δ default, Δ spend, Δ deposits agrees with holdout natural experiments where available.
- Demo engagement: a visitor can run the 20% cut scenario and explain one household path.
- Zero PII in exported ledgers.

---

## 13. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Simulator looks directionally right, is quantitatively wrong | High | Holdout-time calibration; don’t auto-deploy policy |
| Users treat demo numbers as forecasts | High | Chrome disclaimer; synthetic-only labels |
| Fair lending exposure if embeddings leak into decisions | High | Hard separation: sim ≠ decisioning in v1 |
| Shock RNG leaks across arms | Medium | Hash streams per (agent, month, channel) |
| Competitor substitution under-specified | Medium | Explicit decline → wallet-share channel |

---

## 14. Open questions

1. First vertical: cards-only vs. cards + deposits in the same world model?
2. Fairness metric for line-management search?
3. Deployment default: customer VPC vs. isolated SaaS with synthetic-only?
4. Should v1 include a genuine learned world-model head, or stay microsim until a bank data partnership exists?

---

## 15. Key decisions

1. **Hybrid world model** — start with a calibrated microsimulator (shippable, inspectable), leave a slot for learned residuals. Pure end-to-end transformers are uncalibratable for MRM on day one.
2. **Shared-shock counterfactuals** — hash RNG so arms differ only by policy.
3. **Simulation ≠ decisioning** in v1.
4. **Browser demo first** — the PRD’s canonical question is the workbench default.
5. **Customer-controlled data** for any later training.

---

## 16. References

- User brief: world models for retail banking vs. brokerage (this repo).
- SR 11-7, ECOA/Reg B, GLBA, BSA/AML.
- CECL / DFAST practice for delayed credit losses.
