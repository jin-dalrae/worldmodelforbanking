import { usd } from "../engine/format";
import type { SimResult } from "../engine/types";

export function Ledger({ result }: { result: SimResult }) {
  const txns = result.txns.slice(0, 80);
  return (
    <div className="view">
      <div className="kicker">Synthetic ledger</div>
      <h1 style={{ fontSize: "clamp(32px, 4vw, 52px)" }}>
        Privacy-preserving <em>event streams</em>
      </h1>
      <p className="lede" style={{ marginBottom: 22 }}>
        Tracked households emit swipe, decline, and payment events. No PII — names are sampled
        labels on synthetic agents. Export the JSON for sandbox fraud and AML work.
      </p>
      <div className="cta-row" style={{ marginBottom: 16 }}>
        <button
          className="cta"
          onClick={() => {
            const blob = new Blob([JSON.stringify(result.txns, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "world-model-banking-synthetic-ledger.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export JSON
        </button>
      </div>
      <div className="panel">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Day</th>
              <th>Agent</th>
              <th>Merchant</th>
              <th>MCC</th>
              <th>Channel</th>
              <th>Amount</th>
              <th>Bal after</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id}>
                <td>M{t.month + 1}</td>
                <td>{t.day}</td>
                <td>{t.agentName}</td>
                <td>{t.merchant}</td>
                <td>{t.mcc}</td>
                <td>
                  <span className={`pill ${t.channel}`}>{t.channel}</span>
                </td>
                <td>{usd(t.amount, 2)}</td>
                <td>{usd(t.balanceAfter, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
