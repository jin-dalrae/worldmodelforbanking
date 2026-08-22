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
            Macro simulators shock GDP and unemployment. This one simulates households, merchants, and
            rewards — so a marketer can ask whether a new card is used as designed, before it ships.
          </p>
          <div className="cta-row">
            <button className="cta" onClick={() => go("ask")}>
              Ask the desk
            </button>
            <button className="cta ghost" onClick={() => go("workbench")}>
              Open the workbench
            </button>
          </div>
        </div>
        <aside className="quote">
          <p>
            “If we publish this amusement-park card, will they really use it at the park — or stack
            flight miles?”
          </p>
          <span>The question a PD/LGD tape cannot take · ask it in English · get a simulation</span>
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
        <h2>Not another quantitative macro simulator</h2>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>CCAR / Moody&apos;s / Oxford / FRB-US</th>
              <th>This world model</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Unit of simulation</td>
              <td>GDP, unemployment, CPI, then a PD/LGD vector on a loan tape.</td>
              <td>Households, cash buffers, MCC, merchants, wallet share.</td>
            </tr>
            <tr>
              <td>The question it can take</td>
              <td>What happens to charge-offs if unemployment is 8%?</td>
              <td>If we launch this card, do they use it as designed?</td>
            </tr>
            <tr>
              <td>Who it is for</td>
              <td>Treasury, capital, model risk — portfolio loss under a supervisory path.</td>
              <td>Card strategy and marketing — product design, rewards, misuse.</td>
            </tr>
            <tr>
              <td>What it cannot see</td>
              <td>Amusement-park MCC vs airline MCC. Mileage runners. Category leakage.</td>
              <td>A full GSIFI capital stack. Use the bank&apos;s CCAR model for that.</td>
            </tr>
          </tbody>
        </table>
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
