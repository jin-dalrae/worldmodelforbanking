# World Model for Banking

A **chat-first world model** for card strategy and marketing. Not a CCAR box.

> If we publish this new amusement-park card, will they really use it at the park — or stack flight miles?

That is the job. A quantitative macro simulator cannot take it. A scorecard cannot take it. This one can: you ask in English, it runs 1,200 synthetic households, and it tells you how much of the lift is genuine category spend versus manufactured volume.

**Live demo:** [jin-dalrae.github.io/worldmodelforbanking](https://jin-dalrae.github.io/worldmodelforbanking/) · open **Ask**

## Who this is for

| User | What they ask |
| --- | --- |
| **Card strategist** | If we cut this cohort’s line 20% in inflation, what happens to default, spend, and deposits? |
| **Marketer / rewards** | If we launch 5x at parks, is the lift real park spend or mileage-style gaming? |
| **Product** | Does 3% groceries pay for itself on this book, and who farms it? |

It is a briefing desk, not an underwriting engine.

## Why this is not a quantitative macro simulator

Macro models (CCAR, DFAST, Moody’s, Oxford Economics, FRB/US, and the bank’s own enterprise stress platform) are built to answer **portfolio loss under a supervisory path**. They shock GDP, unemployment, CPI, house prices, then multiply a PD/LGD/EAD tape. That is the right tool for capital.

They have no household, no merchant, no MCC, and no one in the model who is trying to farm your reward.

| | Quant macro simulator | This world model |
| --- | --- | --- |
| **State** | Macro aggregates, then a loss vector | Cash buffers, recurring burn, wallet share, merchant/MCC graph |
| **Agents** | Representative consumer, or a loan tape with no behaviour | Boundedly rational households; some pay in full and optimise points |
| **Clock** | Quarterly / annual stress horizon | Irregular events: paycheck, swipe, decline, 90–180 day default |
| **Question** | What is charge-off if U = 8%? | If we launch this card, do they use it as intended? |
| **Output** | PD, LGD, NIM, capital | Genuine lift vs cannibalised vs gamed; who games; whether interchange covers the bonus |
| **Interface** | Scenario file, slide pack | Chat for strategists and marketers, plus a workbench |

A line-cut in a CCAR model changes expected loss. A line-cut here also moves spend, substitution, deposits, and delayed default — because those are the same household.

A 5x amusement-park offer in a macro model does not exist. Here it splits extra volume three ways:

1. **Genuine** — new park/entertainment spend (the intended use)
2. **Cannibalised** — spend already on this card, steered into the bonus category
3. **Gamed** — no underlying park need; the same people who stack flight miles, pointed at whatever MCC you just paid extra for

If gamed is most of the lift, you did not launch a park card. You launched a poorly fenced rewards currency.

## Demo surfaces

| View | Role |
| --- | --- |
| **Ask** | Chat for strategists and marketers. English in, simulation out. |
| **Observatory** | Why this is not a macro model, and not a brokerage world model |
| **Workbench** | Sliders, p10–p90 bands, paired effect intervals, and a policy sweep with the optimum marked |
| **Anatomy** | State / action / transition / reward |
| **Ledger** | Synthetic swipe, decline, payment events; JSON export |

Default stress path on the workbench: inflation 6.5%, unemployment 6.8%, **−20% credit line**.

Ask runs offline by default: a deterministic parser maps the question onto a scenario the engine actually contains (category launch, line change, macro path). Ask something outside that and it says so instead of guessing.

Connect a Gemini key and it gets better at *understanding* you — "triple points at theme parks" resolves to 3% on entertainment rather than falling back to a default. The division of labour is strict:

```
Gemini reads the question  →  the simulator computes  →  Gemini words the reply
```

The language model never produces a number. It is handed the computed figures and forbidden to invent, re-round, or add to them; pull the network cable and the deterministic parser still answers. The key lives in `sessionStorage` for one tab and is never written to the repo. For a deployed build, put it behind a proxy and set `VITE_GEMINI_PROXY` — a key shipped in client JS is a public key.

## One path is an anecdote

Both arms of a run share their shock draws, so the difference between them is *paired*: the luck cancels and what is left is the policy. Run that pairing over 24 shock draws and you get the distribution of the treatment effect, which is the only number worth quoting.

Effect of the canonical −20% line cut, 1,200 households, 18 months:

| Effect at 18m | p10 | p50 | p90 | |
| --- | --- | --- | --- | --- |
| Default rate | −0.42pp | +0.04pp | +0.33pp | **crosses zero — not measured** |
| LTV / household | −$61 | −$45 | −$21 | robust |
| NIM | −$115k | −$110k | −$106k | robust |
| Charge-offs | −$102k | −$74k | −$52k | robust |
| Card spend | −$1.18M | −$1.15M | −$1.11M | robust |

So the headline is not "default rises 0.1pp" — at this sample size the default effect is indistinguishable from noise. The finding is that **cutting the line does not measurably reduce defaults and reliably destroys $21–61 of value per household.** Where an interval straddles zero the workbench prints *inside the noise* instead of a number.

The charts carry a p10–p90 band; the line is the named seed so a quoted figure stays reproducible.

## What should we do, not just what if

A counterfactual evaluates one policy. The workbench also sweeps the credit-line lever across its range and plots risk-adjusted LTV per household at every setting, with the optimum marked.

On this book the peak is at **+5%** — cutting is worth less than leaving it alone at every setting. That is the question a strategist actually has, and a single counterfactual cannot answer it.

## Run locally

```bash
npm install
npm run dev
```

Hash routes: `#ask`, `#observatory`, `#workbench`, `#anatomy`, `#ledger`.

```bash
npm run build
npm run preview
```

Reproduce the headline figures:

```bash
npx tsx src/engine/check.ts
```

GitHub Pages publishes `dist` to the `gh-pages` branch via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## Documents

| File | What it is |
| --- | --- |
| [`docs/prd.md`](docs/prd.md) | Demo requirements |
| [`docs/prd-platform.md`](docs/prd-platform.md) | Bank-hosted platform design |
| [`docs/retail-banking-world-model.html`](docs/retail-banking-world-model.html) | Pitch deck |

## Not this

Not a credit decisioning system. Not a replacement for CCAR. Numbers are synthetic. Do not underwrite from the demo.

And one limit worth stating plainly: the bands cover **shock noise given fixed behavioural parameters**. They do not cover the fact that those parameters are hand-set rather than estimated from a real portfolio. The mechanism is demonstrated; the magnitudes are not calibrated. Fitting them to bank data — and validating the predicted treatment effects against past line-management experiments — is what turns this from a working model of the mechanism into a model of a particular book.

## License

MIT
