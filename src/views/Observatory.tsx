import type { View } from "../nav";

export function Observatory({ go }: { go: (v: View) => void }) {
  return (
    <div className="view">
      <section className="hero">
        <div>
          <div className="kicker">World model · retail banking & credit cards</div>
          <h1>
            Simulate the household,
            <br />
            <em>not the order book.</em>
          </h1>
          <p className="lede">
            Brokerage world models generate stochastic prices and microstructure. This one generates
            cash buffers, recurring burn, merchant graphs, and delayed default — so a bank can ask
            what happens after a policy move, before the losses show up in the quarter.
          </p>
          <div className="cta-row">
            <button className="cta" onClick={() => go("workbench")}>
              Open the workbench
            </button>
            <button className="cta ghost" onClick={() => go("anatomy")}>
              Model anatomy
            </button>
          </div>
        </div>
        <aside className="quote">
          <p>
            “If we cut this cohort’s credit line by 20% during an inflationary spike, how do default
            rates, spending displacement, and deposit retention change over 18 months?”
          </p>
          <span>Canonical counterfactual · 1,200 synthetic households · client-side Monte Carlo</span>
        </aside>
      </section>

      <section className="row cols-3" style={{ marginBottom: 16 }}>
        <article className="panel">
          <h3>Latent state</h3>
          <p>
            Each household is an embedding of cash-flow velocity, wallet share, and risk trajectory —
            not a static bureau score refreshed monthly.
          </p>
        </article>
        <article className="panel">
          <h3>Generative dynamics</h3>
          <p>
            Paychecks, swipes, declines, substitution, unemployment, and medical shocks propagate
            through a bipartite consumer–merchant graph.
          </p>
        </article>
        <article className="panel">
          <h3>Policy actions</h3>
          <p>
            Line cuts, APR, cashback, hardship timing. Rewards: NIM, interchange, charge-offs, churn,
            and risk-adjusted LTV.
          </p>
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>Retail banking vs. brokerage world models</h2>
        <table>
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Capital markets / brokerage</th>
              <th>Retail banking & credit cards</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>State dynamics</td>
              <td>Fast, high-frequency prices and limit order books.</td>
              <td>Discrete, irregular events: paychecks, bills, retail swipes.</td>
            </tr>
            <tr>
              <td>Agent psychology</td>
              <td>Profit-maximizing, latency-sensitive, game-theoretic.</td>
              <td>Habit-driven, boundedly rational, constrained by life events.</td>
            </tr>
            <tr>
              <td>Feedback loop</td>
              <td>Instantaneous clearing and price impact.</td>
              <td>Delayed payoff: defaults in 90–180 days; churn is gradual.</td>
            </tr>
            <tr>
              <td>Graph topology</td>
              <td>Asset correlation and cross-asset contagion.</td>
              <td>Bipartite consumers ↔ merchants; P2P payment networks.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="blocks">
        <article className="panel">
          <h3>Stress testing</h3>
          <p>
            Capital and loss reserves under custom stagflation paths — without waiting for a real
            quarterly default cycle.
          </p>
        </article>
        <article className="panel">
          <h3>Offline policy RL</h3>
          <p>
            Train line-management policies that maximize risk-adjusted LTV under fairness, loss, and
            regulatory constraints. Production rollout stays gated.
          </p>
        </article>
        <article className="panel">
          <h3>Synthetic data & AML</h3>
          <p>
            Statistically faithful, fraud-rich ledgers for sandboxes. Adversarial rings and
            structuring schemes to probe rule engines and GNNs.
          </p>
        </article>
      </section>
    </div>
  );
}
