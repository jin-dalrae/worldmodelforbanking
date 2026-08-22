import { useEffect, useMemo, useState } from "react";
import { createPopulation } from "./engine/population";
import { pct } from "./engine/format";
import { runCounterfactual } from "./engine/simulate";
import {
  CANONICAL_MACRO,
  CANONICAL_POLICY,
  type Macro,
  type Policy,
} from "./engine/types";
import type { View } from "./nav";
import { Anatomy } from "./views/Anatomy";
import { Chat } from "./views/Chat";
import { Ledger } from "./views/Ledger";
import { Observatory } from "./views/Observatory";
import { Workbench } from "./views/Workbench";

export type { View };

const N = 1200;
const MONTHS = 18;
const SEED = 7;
const VIEWS: View[] = ["observatory", "workbench", "ask", "anatomy", "ledger"];

function viewFromHash(): View {
  const h = window.location.hash.replace("#", "") as View;
  return VIEWS.includes(h) ? h : "observatory";
}

export function App() {
  const [view, setViewState] = useState<View>(viewFromHash);
  const setView = (v: View) => {
    setViewState(v);
    if (window.location.hash.replace("#", "") !== v) {
      window.history.replaceState(null, "", `#${v}`);
    }
  };

  useEffect(() => {
    const onHash = () => setViewState(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [macro, setMacro] = useState<Macro>(CANONICAL_MACRO);
  const [policy, setPolicy] = useState<Policy>(CANONICAL_POLICY);
  const [cohort, setCohort] = useState<
    "all" | "transactor" | "prime_revolver" | "near_prime" | "subprime" | "gig"
  >("all");

  const population = useMemo(() => createPopulation(N, SEED), []);
  const agents = useMemo(
    () => (cohort === "all" ? population : population.filter((a) => a.segment === cohort)),
    [population, cohort],
  );
  const pair = useMemo(
    () => runCounterfactual({ agents, months: MONTHS, macro, policy, seed: SEED }),
    [agents, macro, policy],
  );

  const lastI = pair.intervention.months.at(-1);

  return (
    <div className="shell">
      <header className="nav">
        <div className="brand">
          <div className="brand-mark">
            World Model <em>for Banking</em>
          </div>
          <div className="brand-sub">Retail banking &amp; credit cards</div>
        </div>
        <nav className="tabs">
          {(
            [
              ["observatory", "Observatory"],
              ["workbench", "Workbench"],
              ["ask", "Ask"],
              ["anatomy", "Anatomy"],
              ["ledger", "Ledger"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className="tab" data-on={view === id} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="tape">
        <span>
          Cohort <b>{agents.length.toLocaleString()} hh</b>
        </span>
        <span>
          Horizon <b>{MONTHS} months</b>
        </span>
        <span>
          Inflation <b className="up">{pct(macro.inflation)}</b>
        </span>
        <span>
          Unemployment <b className="up">{pct(macro.unemployment)}</b>
        </span>
        <span>
          Line Δ <b>{Math.round(policy.limitDelta * 100)}%</b>
        </span>
        <span>
          Default @18m <b className="up">{pct(lastI?.defaultRate ?? 0)}</b>
        </span>
        <span>
          Wallet share <b className="dn">{pct(lastI?.walletShare ?? 0)}</b>
        </span>
      </div>
      {view === "observatory" && <Observatory go={setView} />}
      {view === "workbench" && (
        <Workbench
          macro={macro}
          policy={policy}
          cohort={cohort}
          n={agents.length}
          months={MONTHS}
          baseline={pair.baseline}
          intervention={pair.intervention}
          onMacro={setMacro}
          onPolicy={setPolicy}
          onCohort={setCohort}
        />
      )}
      {view === "ask" && <Chat agents={agents} months={MONTHS} macro={macro} seed={SEED} />}
      {view === "anatomy" && <Anatomy />}
      {view === "ledger" && <Ledger result={pair.intervention} />}
      <footer className="footer">
        <span>Demo · synthetic households only · not a credit decisioning system.</span>
        <a href="https://github.com/jin-dalrae/worldmodelforbanking">github.com/jin-dalrae/worldmodelforbanking</a>
      </footer>
    </div>
  );
}
