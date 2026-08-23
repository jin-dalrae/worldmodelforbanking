import { LineChart, SweepChart } from "../components/Chart";
import { pct, pp, usd } from "../engine/format";
import { atHorizon, band, effect } from "../engine/paths";
import type { Effect, PathPair, SweepPoint } from "../engine/paths";
import type { Macro, Policy, SimResult } from "../engine/types";

/** An effect the model cannot resolve is shown as such, not as a number. */
function EffectDelta({ e, fmt, goodWhenNegative = false }: { e: Effect; fmt: (n: number) => string; goodWhenNegative?: boolean }) {
  if (!e.robust) {
    return (
      <div className="delta noise" title={`p10 ${fmt(e.p10)} · p90 ${fmt(e.p90)}`}>
        inside the noise · {fmt(e.p10)} to {fmt(e.p90)}
      </div>
    );
  }
  const good = goodWhenNegative ? e.p50 < 0 : e.p50 > 0;
  return (
    <div className={`delta ${good ? "good" : "bad"}`}>
      {fmt(e.p50)} <span className="rng">({fmt(e.p10)} to {fmt(e.p90)})</span>
    </div>
  );
}

type Cohort = "all" | "transactor" | "prime_revolver" | "near_prime" | "subprime" | "gig";

export function Workbench({
  macro,
  policy,
  cohort,
  n,
  months,
  baseline,
  intervention,
  paths,
  sweep,
  pathCount,
  onMacro,
  onPolicy,
  onCohort,
}: {
  macro: Macro;
  policy: Policy;
  cohort: Cohort;
  n: number;
  months: number;
  baseline: SimResult;
  intervention: SimResult;
  paths: PathPair | null;
  sweep: { points: SweepPoint[]; best: SweepPoint; current: number } | null;
  pathCount: number;
  onMacro: (m: Macro) => void;
  onPolicy: (p: Policy) => void;
  onCohort: (c: Cohort) => void;
}) {
  const b = baseline.totals;
  const i = intervention.totals;
  const lastB = baseline.months.at(-1);
  const lastI = intervention.months.at(-1);
  const depDelta = (i.depositsEnd - b.depositsEnd) / Math.max(1, b.depositsEnd);

  const bands = paths
    ? {
        default: { baseline: band(paths.baseline.runs, (m) => m.defaultRate), intervention: band(paths.intervention.runs, (m) => m.defaultRate) },
        spend: { baseline: band(paths.baseline.runs, (m) => m.spend), intervention: band(paths.intervention.runs, (m) => m.spend) },
        deposits: { baseline: band(paths.baseline.runs, (m) => m.deposits), intervention: band(paths.intervention.runs, (m) => m.deposits) },
      }
    : undefined;

  const eff = paths
    ? {
        default: effect(paths, atHorizon((m) => m.defaultRate)),
        ltv: effect(paths, atHorizon((m) => m.ltv)),
        nim: effect(paths, (r) => r.totals.nim),
        chargeOffs: effect(paths, (r) => r.totals.chargeOffs),
        churn: effect(paths, atHorizon((m) => m.churnRate)),
        displaced: effect(paths, (r) => r.totals.displaced),
      }
    : null;

  return (
    <div className="view workbench">
      <aside className="panel controls">
        <h3>Scenario</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Same households, same shocks. Only the policy arm changes.
        </p>
        <label>
          Cohort
          <select value={cohort} onChange={(e) => onCohort(e.target.value as Cohort)}>
            <option value="all">Full book ({n})</option>
            <option value="transactor">Transactors</option>
            <option value="prime_revolver">Prime revolvers</option>
            <option value="near_prime">Near-prime</option>
            <option value="subprime">Subprime</option>
            <option value="gig">Gig / irregular</option>
          </select>
        </label>
        <label>
          Inflation (annual) <span className="val">{pct(macro.inflation)}</span>
          <input
            type="range"
            min={0.01}
            max={0.12}
            step={0.001}
            value={macro.inflation}
            onChange={(e) => onMacro({ ...macro, inflation: Number(e.target.value) })}
          />
        </label>
        <label>
          Unemployment <span className="val">{pct(macro.unemployment)}</span>
          <input
            type="range"
            min={0.03}
            max={0.12}
            step={0.001}
            value={macro.unemployment}
            onChange={(e) => onMacro({ ...macro, unemployment: Number(e.target.value) })}
          />
        </label>
        <label>
          Fed funds <span className="val">{pct(macro.fedFunds)}</span>
          <input
            type="range"
            min={0.01}
            max={0.08}
            step={0.0025}
            value={macro.fedFunds}
            onChange={(e) => onMacro({ ...macro, fedFunds: Number(e.target.value) })}
          />
        </label>
        <h3 style={{ marginTop: 8 }}>Intervention</h3>
        <label>
          Credit line Δ <span className="val">{Math.round(policy.limitDelta * 100)}%</span>
          <input
            type="range"
            min={-0.4}
            max={0.2}
            step={0.01}
            value={policy.limitDelta}
            onChange={(e) => onPolicy({ ...policy, limitDelta: Number(e.target.value) })}
          />
        </label>
        <label>
          APR Δ <span className="val">{(policy.aprDelta * 100).toFixed(1)} pp</span>
          <input
            type="range"
            min={-0.03}
            max={0.05}
            step={0.0025}
            value={policy.aprDelta}
            onChange={(e) => onPolicy({ ...policy, aprDelta: Number(e.target.value) })}
          />
        </label>
        <label>
          Cashback <span className="val">{policy.cashbackBps} bps</span>
          <input
            type="range"
            min={0}
            max={300}
            step={10}
            value={policy.cashbackBps}
            onChange={(e) => onPolicy({ ...policy, cashbackBps: Number(e.target.value) })}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, gridTemplateColumns: "none" }}>
          <input
            type="checkbox"
            checked={policy.hardship}
            onChange={(e) => onPolicy({ ...policy, hardship: e.target.checked })}
          />
          Hardship program
        </label>
        <p className="muted" style={{ fontSize: 12 }}>
          Horizon {months} months · baseline policy is unchanged lines/APR.
        </p>
        {n < 120 && (
          <p className="warn-note">
            Only {n} households in this cohort. Effects will often be indistinguishable from noise.
          </p>
        )}
      </aside>

      <section>
        <h2 className="sr-heading">Counterfactual workbench</h2>
        <div className="legend">
          <span>
            <i className="swatch base" /> Baseline policy
          </span>
          <span>
            <i className="swatch int" /> Intervention
          </span>
          <span className="legend-note">
            {pathCount > 1 ? `line = seed 7 · band = p10–p90 over ${pathCount} shock draws` : "single path"}
          </span>
        </div>
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3>Cumulative default rate</h3>
          <div className="chart-wrap">
            <LineChart
              format="pct"
              bands={bands?.default}
              series={{
                baseline: baseline.months.map((m) => m.defaultRate),
                intervention: intervention.months.map((m) => m.defaultRate),
              }}
            />
          </div>
        </div>
        <div className="row cols-2" style={{ marginBottom: 12 }}>
          <div className="panel">
            <h3>Card spend</h3>
            <div className="chart-wrap">
              <LineChart
                bands={bands?.spend}
                series={{
                  baseline: baseline.months.map((m) => m.spend),
                  intervention: intervention.months.map((m) => m.spend),
                }}
              />
            </div>
          </div>
          <div className="panel">
            <h3>Deposit stock</h3>
            <div className="chart-wrap">
              <LineChart
                bands={bands?.deposits}
                series={{
                  baseline: baseline.months.map((m) => m.deposits),
                  intervention: intervention.months.map((m) => m.deposits),
                }}
              />
            </div>
          </div>
        </div>
        {sweep && (
          <div className="panel" style={{ marginBottom: 12 }}>
            <h3>Where the optimum actually sits</h3>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 6px" }}>
              Risk-adjusted lifetime value per household at every setting of the credit-line lever.
              The dashed line is where you are now.
            </p>
            <div className="chart-wrap">
              <SweepChart points={sweep.points} best={sweep.best} current={sweep.current} />
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>
              Best at <b>{Math.round(sweep.best.limitDelta * 100)}%</b> ({usd(sweep.best.ltvPerHousehold)} per household).
              Cutting is worth less than leaving it alone at every setting on this book.
            </p>
          </div>
        )}
        <div className="panel">
          <h3>Household tape</h3>
          <div className="feed">
            {intervention.narratives.map((e, idx) => (
              <div className="event" data-kind={e.kind} key={`${e.agentId}-${e.month}-${idx}`}>
                <time>
                  M{e.month + 1} · {e.kind.replaceAll("_", " ")}
                </time>
                {e.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="kpis">
        <div className="kpi">
          <div className="lbl">Default rate @ 18m</div>
          <div className="num">{pct(lastI?.defaultRate ?? 0)}</div>
          {eff ? (
            <EffectDelta e={eff.default} fmt={(n) => pp(n)} goodWhenNegative />
          ) : (
            <div className={`delta ${(lastI?.defaultRate ?? 0) > (lastB?.defaultRate ?? 0) ? "bad" : "good"}`}>
              {pp((lastI?.defaultRate ?? 0) - (lastB?.defaultRate ?? 0))} vs baseline {pct(lastB?.defaultRate ?? 0)}
            </div>
          )}
        </div>
        <div className="kpi">
          <div className="lbl">Spend displacement</div>
          <div className="num">{usd(i.displaced)}</div>
          {eff ? (
            <EffectDelta e={eff.displaced} fmt={(n) => usd(n)} goodWhenNegative />
          ) : (
            <div className={`delta ${i.displaced > b.displaced ? "bad" : "good"}`}>{usd(i.displaced - b.displaced)} vs baseline</div>
          )}
        </div>
        <div className="kpi">
          <div className="lbl">Deposit stock @ 18m</div>
          <div className="num">{usd(i.depositsEnd)}</div>
          <div className={`delta ${depDelta >= 0 ? "good" : "bad"}`}>
            {pct(depDelta)} vs baseline
          </div>
        </div>
        <div className="kpi">
          <div className="lbl">NIM (18m)</div>
          <div className="num">{usd(i.nim)}</div>
          {eff ? <EffectDelta e={eff.nim} fmt={(n) => usd(n)} /> : <div className={`delta ${i.nim >= b.nim ? "good" : "bad"}`}>{usd(i.nim - b.nim)}</div>}
        </div>
        <div className="kpi">
          <div className="lbl">Charge-offs</div>
          <div className="num">{usd(i.chargeOffs)}</div>
          {eff ? (
            <EffectDelta e={eff.chargeOffs} fmt={(n) => usd(n)} goodWhenNegative />
          ) : (
            <div className={`delta ${i.chargeOffs > b.chargeOffs ? "bad" : "good"}`}>{usd(i.chargeOffs - b.chargeOffs)}</div>
          )}
        </div>
        <div className="kpi">
          <div className="lbl">Cohort LTV / hh</div>
          <div className="num">{usd(lastI?.ltv ?? 0)}</div>
          {eff ? (
            <EffectDelta e={eff.ltv} fmt={(n) => usd(n)} />
          ) : (
            <div className={`delta ${(lastI?.ltv ?? 0) >= (lastB?.ltv ?? 0) ? "good" : "bad"}`}>{usd((lastI?.ltv ?? 0) - (lastB?.ltv ?? 0))} vs baseline</div>
          )}
        </div>
        <div className="kpi">
          <div className="lbl">Churn @ 18m</div>
          <div className="num">{pct(lastI?.churnRate ?? 0)}</div>
          {eff ? (
            <EffectDelta e={eff.churn} fmt={(n) => pp(n)} goodWhenNegative />
          ) : (
            <div className={`delta ${(lastI?.churnRate ?? 0) > (lastB?.churnRate ?? 0) ? "bad" : "good"}`}>{pp((lastI?.churnRate ?? 0) - (lastB?.churnRate ?? 0))}</div>
          )}
        </div>
      </aside>
    </div>
  );
}
