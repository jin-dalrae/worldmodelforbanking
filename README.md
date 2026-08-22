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
| **Workbench** | Sliders: inflation, unemployment, line, APR, cashback, hardship |
| **Anatomy** | State / action / transition / reward |
| **Ledger** | Synthetic swipe, decline, payment events; JSON export |

Default stress path on the workbench: inflation 6.5%, unemployment 6.8%, **−20% credit line**.

The chat has no language model in the loop. The question selects a scenario the engine actually contains (category launch, line change, macro path). If you ask something outside that, it says so instead of guessing.

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

GitHub Pages publishes `dist` to the `gh-pages` branch via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## Documents

| File | What it is |
| --- | --- |
| [`docs/prd.md`](docs/prd.md) | Demo requirements |
| [`docs/prd-platform.md`](docs/prd-platform.md) | Bank-hosted platform design |
| [`docs/retail-banking-world-model.html`](docs/retail-banking-world-model.html) | Pitch deck |

## Not this

Not a credit decisioning system. Not a replacement for CCAR. Numbers are synthetic. Do not underwrite from the demo.

## License

MIT
