import { runCounterfactual, simulate } from "./simulate";
import { NEUTRAL_POLICY } from "./types";
import type { Agent, Macro, MonthPoint, Policy, SimResult } from "./types";

/**
 * Monte Carlo over shock draws.
 *
 * The population is fixed — the same households every time. What varies between
 * paths is the seed feeding the per-household, per-month shock streams, so each
 * path is the same book living through a different run of luck. Both arms of a
 * path always share that luck, which is what keeps the comparison a paired
 * experiment rather than two unrelated worlds.
 *
 * The canonical path is kept separate and drawn as the line, so a headline
 * figure quoted from the demo stays reproducible; the other paths become the
 * band around it.
 */

export type Band = { p10: number[]; p50: number[]; p90: number[] };

export type PathSet = {
  /** The named seed. Every quoted number comes from this run. */
  canonical: SimResult;
  /** Every path including the canonical one. */
  runs: SimResult[];
};

export type PathPair = { baseline: PathSet; intervention: PathSet };

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Percentile envelope across paths, month by month. */
export function band(runs: SimResult[], pick: (m: MonthPoint) => number): Band {
  const months = runs[0]?.months.length ?? 0;
  const p10: number[] = [];
  const p50: number[] = [];
  const p90: number[] = [];
  for (let m = 0; m < months; m++) {
    const col: number[] = [];
    for (const r of runs) {
      const point = r.months[m];
      if (point) col.push(pick(point));
    }
    col.sort((a, b) => a - b);
    p10.push(percentile(col, 0.1));
    p50.push(percentile(col, 0.5));
    p90.push(percentile(col, 0.9));
  }
  return { p10, p50, p90 };
}

export function runPaths(args: {
  agents: Agent[];
  months: number;
  macro: Macro;
  policy: Policy;
  seed: number;
  paths: number;
}): PathPair {
  const { agents, months, macro, policy, seed, paths } = args;
  const canonical = runCounterfactual({ agents, months, macro, policy, seed });

  const baseRuns: SimResult[] = [canonical.baseline];
  const intRuns: SimResult[] = [canonical.intervention];

  // Offset rather than sequential seeds: the hash mixes poorly for neighbours.
  for (let k = 1; k < paths; k++) {
    const s = seed + k * 7919;
    baseRuns.push(simulate({ agents, months, macro, policy: { ...NEUTRAL_POLICY }, seed: s }));
    intRuns.push(simulate({ agents, months, macro, policy, seed: s }));
  }

  return {
    baseline: { canonical: canonical.baseline, runs: baseRuns },
    intervention: { canonical: canonical.intervention, runs: intRuns },
  };
}

/**
 * The distribution of the *treatment effect*, which is the number a bank should
 * actually be shown.
 *
 * Because both arms of a path share their shock draws, the difference between
 * them is paired: the luck cancels and what is left is the policy. Reporting the
 * spread of that difference is what separates a finding from an anecdote — an
 * effect whose interval straddles zero has not been measured, however precise
 * the single-path number looks.
 */
export type Effect = {
  p10: number;
  p50: number;
  p90: number;
  /** False when the interval contains zero: the sign of the effect is unresolved. */
  robust: boolean;
};

export function effect(pair: PathPair, pick: (r: SimResult) => number): Effect {
  const diffs: number[] = [];
  const n = Math.min(pair.baseline.runs.length, pair.intervention.runs.length);
  for (let k = 0; k < n; k++) {
    diffs.push(pick(pair.intervention.runs[k]) - pick(pair.baseline.runs[k]));
  }
  diffs.sort((a, b) => a - b);
  const p10 = percentile(diffs, 0.1);
  const p50 = percentile(diffs, 0.5);
  const p90 = percentile(diffs, 0.9);
  return { p10, p50, p90, robust: !(p10 <= 0 && p90 >= 0) };
}

/** Last-month reading of a series, for use with `effect`. */
export function atHorizon(pick: (m: MonthPoint) => number) {
  return (r: SimResult) => {
    const last = r.months.at(-1);
    return last ? pick(last) : 0;
  };
}

// ---------------------------------------------------------------------------

export type SweepPoint = {
  limitDelta: number;
  ltvPerHousehold: number;
  defaultRate: number;
  chargeOffs: number;
  nim: number;
  displaced: number;
};

/**
 * Walk the credit-line lever across its range and record what each setting is
 * worth. This is the difference between asking "what if" and asking "what should
 * we do" — the answer is wherever the curve peaks, and it is rarely at zero.
 */
export function sweepLine(args: {
  agents: Agent[];
  months: number;
  macro: Macro;
  seed: number;
  from?: number;
  to?: number;
  step?: number;
  basePolicy?: Policy;
}): { points: SweepPoint[]; best: SweepPoint; current: number } {
  const { agents, months, macro, seed } = args;
  const from = args.from ?? -0.4;
  const to = args.to ?? 0.2;
  const step = args.step ?? 0.05;
  const basePolicy = args.basePolicy ?? NEUTRAL_POLICY;

  const points: SweepPoint[] = [];
  for (let d = from; d <= to + 1e-9; d += step) {
    const limitDelta = Math.round(d * 100) / 100;
    const run = simulate({
      agents,
      months,
      macro,
      policy: { ...basePolicy, limitDelta },
      seed,
    });
    const last = run.months.at(-1);
    points.push({
      limitDelta,
      ltvPerHousehold: last?.ltv ?? 0,
      defaultRate: last?.defaultRate ?? 0,
      chargeOffs: run.totals.chargeOffs,
      nim: run.totals.nim,
      displaced: run.totals.displaced,
    });
  }

  const best = points.reduce((a, b) => (b.ltvPerHousehold > a.ltvPerHousehold ? b : a), points[0]);
  return { points, best, current: basePolicy.limitDelta };
}
