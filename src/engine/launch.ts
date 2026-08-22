import { INTERCHANGE } from "./constants";
import { randn, u01 } from "./rng";
import type { Agent, Category, LaunchResult, SegmentSplit, SimResult } from "./types";

/**
 * Share of card-eligible spend by category, before any reward bonus.
 * Housing/utilities mostly sit off-card, so they are not in this mix.
 */
const BASE_MIX: Record<Category, number> = {
  groceries: 0.22,
  restaurants: 0.16,
  retail: 0.14,
  gas: 0.11,
  health: 0.06,
  entertainment: 0.06,
  travel: 0.06,
  transit: 0.05,
  subscriptions: 0.05,
  auto: 0.05,
  telecom: 0.04,
  utilities: 0,
  housing: 0,
};

/**
 * How hard a segment works a rewards programme. Transactors clear the balance
 * every month and optimise points; thin-file borrowers are not playing that game.
 */
const SAVVY: Record<Agent["segment"], number> = {
  transactor: 0.85,
  prime_revolver: 0.45,
  gig: 0.3,
  near_prime: 0.25,
  subprime: 0.1,
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Per-agent category weights: the base mix tilted by a deterministic draw. */
function mixFor(a: Agent, seed: number): Record<string, number> {
  const w: Record<string, number> = {};
  let total = 0;
  let ch = 60;
  for (const [cat, base] of Object.entries(BASE_MIX)) {
    if (base <= 0) continue;
    const v = base * Math.exp(0.45 * randn(seed, a.id, 0, ch++));
    w[cat] = v;
    total += v;
  }
  for (const k of Object.keys(w)) w[k] /= total;
  return w;
}

/**
 * Model a category-level reward bonus (a co-brand launch, a category multiplier).
 *
 * The lift in bonused-category volume is split three ways:
 *   incremental  — genuinely new to this card (new consumption, or won off a competitor)
 *   cannibalised — spend already on this card, moved into the bonused category
 *   gamed        — volume with no underlying need in the category: manufactured spend,
 *                  mis-coded merchants, points and mileage arbitrage
 *
 * Only incremental volume earns the bank new interchange. The bonus is paid on all of it.
 */
export function simulateLaunch(args: {
  agents: Agent[];
  run: SimResult;
  category: Category;
  bps: number;
  seed: number;
}): LaunchResult {
  const { agents, run, category, bps, seed } = args;
  const b = bps / 10000;
  // A bonus under ~1% is not worth the effort of gaming it.
  const worthGaming = Math.max(0, b - 0.01);

  let baseCat = 0;
  let incremental = 0;
  let cannibalised = 0;
  let gamed = 0;

  const bySeg = new Map<string, { seg: string; base: number; inc: number; can: number; gam: number; n: number }>();

  for (const a of agents) {
    const spend = run.cardSpendByAgent.get(a.id) ?? 0;
    if (spend <= 0) continue;

    const mix = mixFor(a, seed);
    const wc = mix[category] ?? 0;
    const sc = spend * wc;
    const so = spend - sc;

    const savvy = clamp(SAVVY[a.segment] + 0.12 * randn(seed, a.id, 0, 91), 0.02, 0.98);
    // Households with no cash buffer cannot spend more, however good the offer is.
    const liquidity = clamp(a.cash / Math.max(1, a.burn) / 2, 0, 1);

    const inc = sc * Math.min(0.3, 1.4 * b) * (0.35 + 0.65 * liquidity);
    const can = so * Math.min(0.2, 1.0 * b) * (0.35 + 0.65 * savvy);
    const gam = so * Math.min(0.35, 2.2 * worthGaming) * savvy * savvy;

    baseCat += sc;
    incremental += inc;
    cannibalised += can;
    gamed += gam;

    const key = a.segment;
    const row = bySeg.get(key) ?? { seg: key, base: 0, inc: 0, can: 0, gam: 0, n: 0 };
    row.base += sc;
    row.inc += inc;
    row.can += can;
    row.gam += gam;
    row.n += 1;
    bySeg.set(key, row);
  }

  const lift = incremental + cannibalised + gamed;
  const bonusedVolume = baseCat + lift;
  const rewardCost = bonusedVolume * b;
  const newInterchange = incremental * INTERCHANGE;
  const net = newInterchange - rewardCost;

  const segments: SegmentSplit[] = [...bySeg.values()]
    .map((r) => ({
      segment: r.seg,
      households: r.n,
      lift: r.inc + r.can + r.gam,
      gamedShare: r.inc + r.can + r.gam > 0 ? r.gam / (r.inc + r.can + r.gam) : 0,
    }))
    .sort((x, y) => y.gamedShare - x.gamedShare);

  return {
    category,
    bps,
    baseCategorySpend: baseCat,
    incremental,
    cannibalised,
    gamed,
    lift,
    bonusedVolume,
    rewardCost,
    newInterchange,
    net,
    genuineShare: lift > 0 ? incremental / lift : 0,
    gamedShare: lift > 0 ? gamed / lift : 0,
    segments,
    breakevenBps: breakeven(args),
  };
}

/** Largest bonus (to the nearest 5bps) at which the programme still pays for itself. */
function breakeven(args: { agents: Agent[]; run: SimResult; category: Category; seed: number }): number {
  let lo = 0;
  for (let bps = 5; bps <= 800; bps += 5) {
    const r = simulateLaunchNet({ ...args, bps });
    if (r > 0) lo = bps;
    else break;
  }
  return lo;
}

/** Net-only evaluation, used by the breakeven scan. Mirrors simulateLaunch. */
function simulateLaunchNet(args: {
  agents: Agent[];
  run: SimResult;
  category: Category;
  bps: number;
  seed: number;
}): number {
  const { agents, run, category, bps, seed } = args;
  const b = bps / 10000;
  const worthGaming = Math.max(0, b - 0.01);
  let baseCat = 0;
  let incremental = 0;
  let other = 0;

  for (const a of agents) {
    const spend = run.cardSpendByAgent.get(a.id) ?? 0;
    if (spend <= 0) continue;
    const mix = mixFor(a, seed);
    const sc = spend * (mix[category] ?? 0);
    const so = spend - sc;
    const savvy = clamp(SAVVY[a.segment] + 0.12 * randn(seed, a.id, 0, 91), 0.02, 0.98);
    const liquidity = clamp(a.cash / Math.max(1, a.burn) / 2, 0, 1);
    baseCat += sc;
    incremental += sc * Math.min(0.3, 1.4 * b) * (0.35 + 0.65 * liquidity);
    other +=
      so * Math.min(0.2, 1.0 * b) * (0.35 + 0.65 * savvy) +
      so * Math.min(0.35, 2.2 * worthGaming) * savvy * savvy;
  }
  const bonusedVolume = baseCat + incremental + other;
  return incremental * INTERCHANGE - bonusedVolume * b;
}

/** Deterministic tie-break helper kept for parity with the rest of the engine. */
export function launchSeedNoise(seed: number, id: number): number {
  return u01(seed, id, 0, 99);
}
