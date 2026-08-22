import { simulateLaunch } from "./launch";
import { runCounterfactual } from "./simulate";
import { pct, usd } from "./format";
import type { Agent, Answer, Category, Macro, Policy } from "./types";
import { CANONICAL_MACRO, NEUTRAL_POLICY } from "./types";

/**
 * Turns a plain-language question into a simulation run.
 *
 * There is no language model here. The question selects a scenario, the engine
 * runs it, and every number in the answer comes back out of that run. If the
 * question is outside what the engine models, we say so rather than guessing.
 */

const CATEGORY_WORDS: [RegExp, Category][] = [
  [/amusement|theme ?park|roller ?coaster|water ?park|attraction/i, "entertainment"],
  [/entertainment|cinema|movie|concert|ticket/i, "entertainment"],
  [/flight|airline|mile|air ?travel|hotel|holiday|vacation|travel/i, "travel"],
  [/grocer|supermarket|food shop/i, "groceries"],
  [/restaurant|dining|dine|eat out|takeaway|takeout|coffee/i, "restaurants"],
  [/fuel|petrol|\bgas\b/i, "gas"],
  [/retail|shopping|store/i, "retail"],
  [/transit|subway|bus|train|commut/i, "transit"],
  [/subscription|streaming/i, "subscriptions"],
  [/health|pharmacy|medical|clinic/i, "health"],
  [/\bauto\b|\bcar\b|garage/i, "auto"],
  [/telecom|phone|mobile/i, "telecom"],
];

const SEGMENT_WORDS: [RegExp, string][] = [
  [/transactor/i, "transactor"],
  [/prime revolver|prime-revolver/i, "prime_revolver"],
  [/near.?prime/i, "near_prime"],
  [/subprime|sub-prime|thin.?file/i, "subprime"],
  [/\bgig\b|freelance|irregular/i, "gig"],
];

function findCategory(q: string): Category | null {
  for (const [re, cat] of CATEGORY_WORDS) if (re.test(q)) return cat;
  return null;
}

function findSegment(q: string): string | null {
  for (const [re, seg] of SEGMENT_WORDS) if (re.test(q)) return seg;
  return null;
}

/** Reward size: "5%", "500bps", "5x points". Defaults to 5%. */
function findBps(q: string): number {
  const bps = q.match(/(\d+(?:\.\d+)?)\s*(?:bps|basis)/i);
  if (bps) return Math.round(parseFloat(bps[1]));
  const pctM = q.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|pct)/i);
  if (pctM) return Math.round(parseFloat(pctM[1]) * 100);
  const x = q.match(/(\d+(?:\.\d+)?)\s*x\b/i);
  if (x) return Math.round(Math.max(0, parseFloat(x[1]) - 1) * 100);
  return 500;
}

/** Line change: "cut 20%", "raise limits 10%". Returns a signed fraction. */
function findLimitDelta(q: string): number {
  const m = q.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|pct)/i);
  const mag = m ? parseFloat(m[1]) / 100 : 0.2;
  const up = /increase|raise|lift|extend|grow|expand/i.test(q);
  return up ? mag : -mag;
}

function money(n: number): string {
  return (n < 0 ? "−" : "") + usd(Math.abs(n));
}

/** Percentage points, but honest when the movement is negligible. */
function pp(d: number): string {
  const v = d * 100;
  if (Math.abs(v) < 0.05) return "barely moves";
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}pp`;
}

function segLabel(s: string): string {
  return s.replace(/_/g, " ");
}

export function ask(
  question: string,
  ctx: { agents: Agent[]; months: number; macro: Macro; seed: number },
): Answer {
  const q = question.trim();
  const { agents, months, seed } = ctx;

  const wantsLaunch =
    /launch|new card|co.?brand|rewards?|cashback|cash back|bonus|multiplier|points|miles|offer/i.test(q);
  const wantsLine = /credit line|limit|line cut|cut the line|underwrit/i.test(q);
  const wantsStress = /recession|downturn|stagflation|inflation|unemployment|shock|stress/i.test(q);
  const category = findCategory(q);

  // ---- product / rewards question -------------------------------------------------
  if (wantsLaunch || (category && !wantsLine)) {
    if (!category) {
      return {
        kind: "clarify",
        title: "Which category is the reward on?",
        prose:
          "I can simulate a category reward once I know the category. The engine carries groceries, restaurants, retail, gas, health, entertainment, travel, transit, subscriptions, auto and telecom.",
        chips: [
          "Launch a 5% entertainment card",
          "What if we put 5% on travel?",
          "3% on groceries — does it pay?",
        ],
      };
    }
    const bps = findBps(q);
    const run = runCounterfactual({ agents, months, macro: ctx.macro, policy: { ...NEUTRAL_POLICY }, seed })
      .baseline;
    const r = simulateLaunch({ agents, run, category, bps, seed });

    const worst = r.segments[0];
    const rate = `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;
    const misuse = /intended|wrong|really use|stack|mileage|miles|flight|game|misuse|abuse/i.test(q);
    const park = category === "entertainment";

    const verdict =
      r.net >= 0
        ? `At ${rate} this pays for itself, but only just — the margin is ${money(r.net)} over ${months} months.`
        : `At ${rate} this loses ${money(-r.net)} over ${months} months. You pay the bonus on ${money(r.bonusedVolume)} of volume to earn interchange on ${money(r.incremental)} of genuinely new spend.`;

    const gaming =
      r.gamedShare > 0.25
        ? `Roughly ${pct(r.gamedShare)} of the extra ${category} volume has no underlying ${category} need behind it — that is spend routed through the category to harvest the reward. ${worst ? segLabel(worst.segment) : "Some"} households do it hardest.`
        : `Gaming stays modest at this level: about ${pct(r.gamedShare)} of the lift has no real ${category} need behind it.`;

    const intended =
      misuse && park
        ? `They will not mainly use it as an amusement-park card. Of the lift, ${pct(r.genuineShare)} is genuine extra park/entertainment spend; ${pct(r.cannibalised / Math.max(r.lift, 1))} is spend already on this card, re-labelled into the bonus; ${pct(r.gamedShare)} is manufactured volume — the same households who stack flight miles, now pointing the optimiser at whatever MCC you just paid extra for. Fence MCC 7996 tightly or you are buying a travel-arbitrage book.`
        : misuse
          ? `Intended use is the minority of the lift. ${pct(r.genuineShare)} is new ${category} demand; ${pct(r.gamedShare)} is households with no ${category} need, harvesting the bonus the way mileage runners harvest airline categories.`
          : `${verdict} ${gaming}`;

    return {
      kind: "result",
      title: misuse && park
        ? `Will a ${rate} amusement-park card be used as intended?`
        : `${rate} on ${category}, ${months} months, ${agents.length.toLocaleString()} households`,
      metrics: [
        { label: "Bonused volume", value: money(r.bonusedVolume) },
        { label: "Reward paid out", value: money(-r.rewardCost), tone: "bad" },
        { label: "Genuinely new volume", value: money(r.incremental) },
        { label: "Interchange on new spend", value: money(r.newInterchange), tone: "good" },
        { label: "Net", value: money(r.net), tone: r.net >= 0 ? "good" : "bad" },
      ],
      split: {
        label: "Where the extra volume comes from",
        parts: [
          { label: "Genuinely new to the card", value: r.incremental, tone: "good" },
          { label: "Moved from other categories", value: r.cannibalised, tone: "warn" },
          { label: "No real need — gamed", value: r.gamed, tone: "bad" },
        ],
      },
      prose: intended,
      footnote:
        r.breakevenBps > 0
          ? `Break-even is around ${(r.breakevenBps / 100).toFixed(2)}% on this cohort. Above that, every extra basis point is paid on volume you already had.`
          : `There is no bonus level on this cohort where the interchange covers the reward — the base category volume is too large relative to the new spend it attracts.`,
      caveat:
        "Modelled: category mix, liquidity limits on real extra spend, and reward-seeking behaviour by segment. Not modelled: competitor reward responses, annual fees, or merchant-funded offers.",
    };
  }

  // ---- credit line question -------------------------------------------------------
  if (wantsLine) {
    const delta = findLimitDelta(q);
    const segment = findSegment(q);
    const pool = segment ? agents.filter((a) => a.segment === segment) : agents;
    if (pool.length < 25) {
      return {
        kind: "clarify",
        title: "Not enough households in that cohort",
        prose: `That filter leaves ${pool.length} households, which is too few to read anything from. Try the full book or a larger segment.`,
        chips: ["Cut the line 20% for near-prime", "What if we raise limits 10%?"],
      };
    }
    const policy: Policy = { ...NEUTRAL_POLICY, limitDelta: delta };
    const { baseline, intervention } = runCounterfactual({ agents: pool, months, macro: ctx.macro, policy, seed });
    const b = baseline.months.at(-1)!;
    const i = intervention.months.at(-1)!;
    const dLtv = i.ltv - b.ltv;

    return {
      kind: "result",
      title: `${delta < 0 ? "Cutting" : "Raising"} the line ${Math.abs(Math.round(delta * 100))}% · ${segment ? segLabel(segment) : "full book"} · ${pool.length.toLocaleString()} households`,
      metrics: [
        { label: "Default @18m", value: pct(i.defaultRate), tone: i.defaultRate > b.defaultRate ? "bad" : "good" },
        { label: "Charge-offs", value: money(intervention.totals.chargeOffs - baseline.totals.chargeOffs), tone: intervention.totals.chargeOffs < baseline.totals.chargeOffs ? "good" : "bad" },
        { label: "NIM", value: money(intervention.totals.nim - baseline.totals.nim), tone: intervention.totals.nim >= baseline.totals.nim ? "good" : "bad" },
        { label: "LTV / household", value: money(dLtv), tone: dLtv >= 0 ? "good" : "bad" },
      ],
      prose:
        dLtv < 0
          ? `Against the same households under the same shocks, this leaves the cohort ${money(-dLtv)} per household worse off. Default ${pp(i.defaultRate - b.defaultRate)}, so the credit saving is smaller than the revenue and the relationship it costs.`
          : `This comes out ${money(dLtv)} per household ahead, with default ${pp(i.defaultRate - b.defaultRate)}.`,
      caveat: "Both arms share the same hash-seeded shocks, so the difference is the policy and not luck.",
    };
  }

  // ---- macro question -------------------------------------------------------------
  if (wantsStress) {
    const num = (word: RegExp) => {
      const after = q.match(new RegExp(word.source + "[^\\d%]{0,12}(\\d+(?:\\.\\d+)?)", "i"));
      if (after) return parseFloat(after[1]);
      const before = q.match(new RegExp("(\\d+(?:\\.\\d+)?)\\s*%?\\s*(?:of\\s+)?" + word.source, "i"));
      return before ? parseFloat(before[1]) : null;
    };
    const infl = num(/inflation/);
    const unemp = num(/unemploy\w*/);
    const macro: Macro = {
      ...CANONICAL_MACRO,
      inflation: infl !== null ? infl / 100 : ctx.macro.inflation,
      unemployment: unemp !== null ? unemp / 100 : ctx.macro.unemployment,
    };
    const calm = runCounterfactual({ agents, months, macro: ctx.macro, policy: { ...NEUTRAL_POLICY }, seed }).baseline;
    const hard = runCounterfactual({ agents, months, macro, policy: { ...NEUTRAL_POLICY }, seed }).baseline;
    const c = calm.months.at(-1)!;
    const h = hard.months.at(-1)!;
    return {
      kind: "result",
      title: `Inflation ${pct(macro.inflation)}, unemployment ${pct(macro.unemployment)} · no policy change`,
      metrics: [
        { label: "Default @18m", value: pct(h.defaultRate), tone: h.defaultRate > c.defaultRate ? "bad" : "good" },
        { label: "vs current", value: pp(h.defaultRate - c.defaultRate) },
        { label: "Charge-offs", value: money(hard.totals.chargeOffs - calm.totals.chargeOffs), tone: "bad" },
        { label: "Card spend", value: money(hard.totals.spend - calm.totals.spend), tone: "bad" },
      ],
      prose:
        "This holds policy flat and moves only the climate, so the difference is the economy doing it rather than the bank. Add a lever to the question to see the two interact.",
      caveat: "Shocks are drawn per household, month and channel from the same seed in both arms.",
    };
  }

  // ---- outside what the engine models ----------------------------------------------
  return {
    kind: "unsupported",
    title: "The engine cannot answer that one",
    prose:
      "I only answer from a simulation run, so I am limited to what the model actually contains: household cash flow, credit lines, category spend, merchant substitution, delinquency and churn. Anything outside that I would be making up.",
    chips: [
      "Launch a 5% amusement park card — will it be used as intended?",
      "Cut the line 20% for subprime",
      "What happens at 9% inflation?",
      "Put 3% on groceries instead",
    ],
  };
}
