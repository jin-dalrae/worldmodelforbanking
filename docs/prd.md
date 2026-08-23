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

**UC-1 Canonical counterfactual (P0).** User sets inflation, unemployment, and a −20% line cut. System compares baseline policy vs. intervention on the same households and shocks over 18 months. Acceptance: the run reports the **paired** effect on default rate, displaced spend, deposits, NIM and LTV as p10/p50/p90 over K ≥ 20 shock draws; any effect whose interval contains zero is labelled unresolved rather than quoted; the household tape explains a sample of paths.

On the reference book this bites immediately: the default effect of a −20% cut spans −0.42pp to +0.33pp and is **not measurable**, while LTV per household (−$61 to −$21) and NIM (−$115k to −$106k) are. Reporting "+0.1pp default" as a finding would be an artefact of a single seed.

**UC-1b Policy search (P0).** From the same scenario, sweep the credit-line lever across its range and report LTV per household at each setting with the optimum marked. Acceptance: the sweep identifies a setting at least as good as no-change, and the interface states where the current setting sits relative to it.

**UC-2 Stress testing (P0).** User specifies a stagflation path and reads capital-relevant loss and NIM. Acceptance: monthly 30+/90+ and charge-off curves exportable.

**UC-3 Offline policy search (P1).** Constraint-aware search over line/APR/hardship. Acceptance: no policy that breaches configured loss, fairness, or utilization caps is marked feasible.

**UC-4 Synthetic ledger (P0).** Export JSON/CSV of swipe, decline, payment events with MCC and amounts. Acceptance: no real PII; names are sampled labels.

**UC-6 Product launch and misuse (P0).** A rewards manager asks whether a category bonus — a co-brand launch, a category multiplier — will be used as intended. System reports the lift in bonused-category volume split into genuinely incremental, cannibalised from other categories, and gamed, plus which segments game hardest and whether interchange on genuinely new spend covers the reward. Acceptance: the split sums to the lift; the answer names a break-even bonus level or states that none exists; the caveat lists what is not funded in the model (annual fees, merchant-funded offers).

*This is the use case a macro simulator cannot express at all: it has no merchant, no category and no one in it who is trying to farm the reward.*

**UC-7 Ask (P0).** A strategist or marketer asks in English and gets an answer computed by a simulation run. Acceptance: in-scope questions resolve to a scenario the engine contains; out-of-scope questions are declined with what the model does contain; no figure in any answer originates outside a run.

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
| FR-012 | **P0** | **Monte Carlo over shock draws.** Every scenario runs K ≥ 20 paths. The population is held fixed; the seed feeding per-household, per-month shock streams varies. Both arms of a path share their draws. |
| FR-013 | **P0** | **Paired treatment effect with intervals.** Report the p10/p50/p90 of the *difference* between arms, not the difference of two point estimates. Charts carry a p10–p90 band; the drawn line is the named seed so a quoted figure stays reproducible. |
| FR-014 | **P0** | **Refuse unresolved effects.** Where the p10–p90 interval of an effect contains zero, the interface prints *inside the noise* and the interval, never a point estimate. This applies to chat answers as well as tiles. |
| FR-015 | **P0** | **Policy search over a lever.** Sweep the credit line across its range, report risk-adjusted LTV per household at each setting, and mark the optimum. Evaluating one policy is not the job; finding the best one is. |
| FR-016 | **P0** | **Category-level reward action space.** A bonus on a named merchant category (co-brand launch, category multiplier), not only a flat cashback rate. |
| FR-017 | **P0** | **Reward-seeking behaviour.** Households differ in how hard they work a rewards programme. Lift in a bonused category splits into genuinely incremental, cannibalised from other categories, and gamed (no underlying need). Report the split and which segments game hardest. |
| FR-018 | **P0** | **Natural-language query surface.** A strategist or marketer asks in English; the question selects a scenario the engine contains and the engine answers. Out-of-scope questions are declined, not guessed. |
| FR-019 | P1 | **Optional LLM bridge, bounded.** A language model may parse the question and word the reply. It must never produce, alter or re-round a figure. Every number originates in a simulation run. The product must remain fully functional with the bridge disconnected. |
| FR-020 | P1 | Small-cohort warning when a filtered cohort is too thin for effects to resolve |

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

**Actions.** `limitDelta`, `aprDelta`, `cashbackBps`, `hardship`, and a **category reward** (`{category, bps}`) covering co-brand launches and category multipliers. Later: authorization strategy, balance-transfer offers.

Retail banking's live decisions are product decisions as much as risk decisions. An action space that only moves limits and rates cannot take the question a rewards manager actually has, which is whether a launch will be used as intended.

**Reward (monthly, then discounted at 12% annual):**

`R = NIM + interchange − charge-off − churn cost − cashback`

NIM = interest − (fed funds + 50 bps) × receivables. Interchange ≈ 1.8% of card spend. Recovery 18% at default.

---

## 10. Demo vs. platform

| Layer | This repository (demo) | Platform (subsequent PRs) |
| --- | --- | --- |
| Dynamics | Calibrated agent-based microsim, hash-seeded shocks, reward-seeking behaviour | Microsim + learned residual / event generator |
| Uncertainty | 24 shock draws; paired effect intervals; effects that straddle zero are declared unresolved | Parameter posterior as well as shock draws; intervals that widen honestly under estimation error |
| Search | Single-lever sweep with the optimum marked | Constrained policy search over the full action space |
| Data | Fully synthetic population | Bank-hosted tokenized streams |
| Interface | Single-page workbench plus a natural-language Ask surface | Scenario API, MRM console, policy search |
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
| **Behavioural parameters are asserted, not estimated** | **High** | Every hazard and choice coefficient in the engine is hand-set. Bands therefore cover shock noise only, not estimation error, and are narrower than the truth. State this wherever intervals are shown; fitting to a real portfolio is the first task with a design partner. |
| **Survivorship artefact in reported rates** | Medium | Churned and defaulted households leave the active pool, so a policy that drives attrition can *lower* a measured rate without helping anyone — raising APR does exactly this on the reference book. Read rate effects alongside the churn effect, never alone. |
| Single-seed reporting mistaken for a finding | High | Paired intervals are mandatory (FR-013); the interface refuses point estimates for unresolved effects (FR-014) |

---

## 14. Open questions

1. First vertical: cards-only vs. cards + deposits in the same world model?
2. Fairness metric for line-management search?
3. Deployment default: customer VPC vs. isolated SaaS with synthetic-only?
4. Should v1 include a genuine learned world-model head, or stay microsim until a bank data partnership exists?

---

## 15. Key decisions

0. **Uncertainty is constitutive, not a feature.** A world model that returns a point estimate is a calculator. The unit of output is a distribution over futures, and the unit of *evidence* is the paired difference between arms sharing the same shocks. An effect whose interval straddles zero has not been measured, however precise the single-path number looks.

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
