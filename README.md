# World Model for Banking

While brokerage world models simulate prices and order books, this one simulates household cash flow, credit lines, and payment networks.

> If we cut this cohort’s credit line by 20% during an inflationary spike, how do default rates, spending displacement, and deposit retention change over 18 months?

That is the canonical counterfactual in the product requirements. Scorecards rank risk at a point in time. Champion/challenger tests buy an answer with real customers. Monte Carlo PD/LGD shocks a loss vector. None of them generate the event-level life of a household under a policy that has not been tried.

This repository is the **interactive demo** of that loop: 1,200 synthetic households, 18 months, two arms that share the same idiosyncratic shocks. Only the issuer action changes. It is decision support, not underwriting.

**Live demo:** [jin-dalrae.github.io/worldmodelforbanking](https://jin-dalrae.github.io/worldmodelforbanking/)

## The gap

Retail banking is a generative process over people, cash, and multi-party payment networks. Events are irregular (paycheck, rent ACH, grocery swipe, decline). Payoffs are delayed (90–180 day default; gradual churn). Agents are habit-driven and boundedly rational.

| Tool | What it does well | Why it fails this job |
| --- | --- | --- |
| Bureau scorecards / PD-LGD-EAD | Rank-order risk given features | No `P(S_{t+1} | S_t, A_t)`; no spend or deposit side effects |
| Champion/challenger | Unbiased live A/B | Slow, costly, ethically constrained; cannot test recessions |
| Monte Carlo credit models | Calibrated loss distributions | Independent draws; no household cash engine; no merchant substitution |
| CCAR/DFAST models | Regulatory capital under supervisory paths | Portfolio-level; not a 10k-account product experiment |
| Brokerage world models | Prices, order books, market impact | Wrong state, wrong agents, wrong graph, wrong clock |

The platform thesis in [`docs/prd-platform.md`](docs/prd-platform.md) is a governed, bank-hosted simulator of that physics. This repo is the proof of mechanism: the canonical question, an inspectable household tape, and a synthetic ledger.

## Demo surfaces

| View | Role | PRD use case |
| --- | --- | --- |
| **Observatory** | Thesis, brokerage vs. banking table, entry into the workbench | Vision |
| **Workbench** | Macro + policy sliders; paired baseline vs. intervention; monthly series and household narratives | UC-1 canonical counterfactual, UC-2 stress path |
| **Anatomy** | State / action / transition / reward diagram | World-model anatomy |
| **Ledger** | Synthetic swipe, decline, and payment events; JSON export | UC-4 synthetic ledger |

Default scenario (PRD UC-1): inflation 6.5%, unemployment 6.8%, fed funds 4.75%, **−20% credit line**, no APR or cashback change, hardship off. Cohorts: all, transactor, prime revolver, near-prime, subprime, gig.

```
State S_t                         Action / policy A_t
• Cash buffers, deposit stock     • Credit-limit Δ
• Recurring burn                  • APR Δ
• Merchant graph / MCC mix        • Cashback / incentives
• Macro (CPI, U, fed funds)       • Hardship timing
                    └──────┬──────┘
                           ▼
         Transition P(S_{t+1} | S_t, A_t)
         • Habit spend and liquidity-constrained demand
         • Shared unemployment / inflation / medical shocks
         • Decline → competitor card, debit, or abandon
                           ▼
         Next state S_{t+1}  +  Reward R_t
         • NIM  • Interchange  • Charge-offs  • Churn  • LTV
```

Reward (monthly, discounted at 12% annual), matching the demo PRD:

`R = NIM + interchange − charge-off − churn cost − cashback`

NIM is interest minus (fed funds + 50 bps) × receivables. Interchange is ~1.8% of card spend. Recovery at default is 18%.

Shocks are **hash-seeded per (agent, month, channel)** so the two arms are a true counterfactual: same households, same luck, different policy.

## Demo vs. platform

The demo is a calibrated microsimulation — habit spend, cash buffers, delayed default, competitor substitution — not a trained foundation model. That is intentional: inspectable, deterministic, and enough to demonstrate the loop. Learned residual dynamics on bank-hosted data are a later layer, not this bundle.

| Layer | This repository (demo) | Platform (`docs/prd-platform.md`) |
| --- | --- | --- |
| Dynamics | Calibrated agent-based microsim, hash-seeded shocks | L0 ledger + L1 ABM + L2 event-transformer residual + L3 shocks |
| Data | Fully synthetic population (seed 7) | Bank-hosted tokenized streams in the customer VPC |
| Interface | Single-page Observatory / Workbench / Anatomy / Ledger | Scenario API, MRM console, Gymnasium env, synthetic export |
| Governance | Footer disclaimer + seed | Lineage, model cards, fairness gates, `decision_support_only: true` |
| Scale | ≥1,000 households × 18 months × 2 arms in the browser | 1M accounts × 18 months × 100 paths overnight |

v1 of the platform is **decision-support simulation**. It is not a closed-loop production decisioning engine. Offline RL may train in sim; production rollout is a gated later phase.

## Documents

| File | What it is |
| --- | --- |
| [`docs/prd.md`](docs/prd.md) | **Demo** product requirements: problem, personas, UC-1–UC-5, functional/NFR list, state–action–reward for the browser engine, demo vs. platform, governance, open questions |
| [`docs/prd-platform.md`](docs/prd-platform.md) | **Platform** PRD + technical design: hybrid kernel (L0–L4), schemas, APIs, Gymnasium, calibration gates, SR 11-7 artifacts, VPC architecture |
| [`docs/retail-banking-world-model.html`](docs/retail-banking-world-model.html) | Pitch deck of the same argument (open in a browser) |

Read `docs/prd.md` first if you want to know what this UI is supposed to prove. Read `docs/prd-platform.md` if you want the system that would sit in a bank VPC.

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL. Hash routes: `#observatory`, `#workbench`, `#anatomy`, `#ledger`.

```bash
npm run build
npm run preview
```

GitHub Pages builds `dist` from `main` via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## Repository layout

| Path | Role |
| --- | --- |
| `src/engine/` | Population, shared-shock simulator, reward (NIM, interchange, losses, LTV) |
| `src/views/` | Observatory, Workbench, Anatomy, Ledger |
| `src/components/` | Charts |
| `docs/` | PRDs and deck |
| `.github/workflows/pages.yml` | Pages deploy |

## Not this

This is **not** a credit decisioning system. Numbers are synthetic. Do not underwrite from the demo. Latent embeddings are not ECOA adverse-action reasons. The simulator does not replace a bank’s CECL or CCAR production models.

## License

MIT
