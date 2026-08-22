import { useMemo, useRef, useState } from "react";
import { ask } from "../engine/ask";
import { askLive } from "../engine/askLive";
import { isLive, setKey } from "../engine/gemini";
import type { Agent, Answer, Macro } from "../engine/types";

type Turn = { q: string; a: Answer; live?: boolean };

const OPENERS = [
  "If we launch a 5% amusement park card, will they use it as intended or stack flight miles?",
  "What if we put 2% on entertainment instead?",
  "Cut the line 20% for subprime",
  "What happens at 9% inflation?",
];

function Bar({ parts }: { parts: { label: string; value: number; tone: string }[] }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  return (
    <div className="split">
      <div className="split-bar" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}>
        {parts.map((p) => (
          <i key={p.label} data-tone={p.tone} style={{ width: `${(Math.max(0, p.value) / total) * 100}%` }} />
        ))}
      </div>
      <div className="split-key">
        {parts.map((p) => (
          <span key={p.label} data-tone={p.tone}>
            <i />
            {p.label} · {Math.round((Math.max(0, p.value) / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function AnswerCard({ a }: { a: Answer }) {
  if (a.kind !== "result") {
    return (
      <div className="answer">
        <h4>{a.title}</h4>
        <p>{a.prose}</p>
        <div className="chips">
          {a.chips.map((c) => (
            <span key={c} className="chip-static">
              {c}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="answer">
      <h4>{a.title}</h4>
      <div className="metric-row">
        {a.metrics.map((m) => (
          <div className="metric" key={m.label} data-tone={m.tone ?? "none"}>
            <span className="ml">{m.label}</span>
            <span className="mv">{m.value}</span>
          </div>
        ))}
      </div>
      {a.split && (
        <>
          <div className="split-label">{a.split.label}</div>
          <Bar parts={a.split.parts} />
        </>
      )}
      <p>{a.prose}</p>
      {a.footnote && <p className="foot">{a.footnote}</p>}
      {a.caveat && <p className="caveat">{a.caveat}</p>}
    </div>
  );
}

export function Chat({
  agents,
  months,
  macro,
  seed,
}: {
  agents: Agent[];
  months: number;
  macro: Macro;
  seed: number;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(isLive());
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const ctx = useMemo(() => ({ agents, months, macro, seed }), [agents, months, macro, seed]);

  function scrollDown() {
    requestAnimationFrame(() => {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setDraft("");

    if (!live) {
      setTurns((t) => [...t, { q, a: ask(q, ctx) }]);
      scrollDown();
      return;
    }

    // Show the simulated answer immediately, then let Gemini re-word it.
    setBusy(true);
    setTurns((t) => [...t, { q, a: ask(q, ctx) }]);
    scrollDown();
    try {
      const { answer, live: wasLive } = await askLive(q, ctx);
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { q, a: answer, live: wasLive } : turn)));
    } finally {
      setBusy(false);
      scrollDown();
    }
  }

  return (
    <div className="view chat">
      <div className="chat-head">
        <div>
          <div className="kicker">For bank strategists &amp; marketers</div>
          <h1 style={{ fontSize: "clamp(28px, 3.4vw, 40px)", margin: "6px 0 10px" }}>
            Questions a macro model <em>cannot take</em>
          </h1>
          <p className="lede" style={{ marginBottom: 0 }}>
            A CCAR-style simulator can shock unemployment and multiply a PD vector. It cannot tell
            you whether a new amusement-park card is used at the park, or farmed for flight miles.
            Ask in English. Every number here is a household simulation, not a language model.
          </p>
        </div>
      </div>

      <div className="live-row">
        <span className="live-dot" data-on={live} aria-hidden="true" />
        <span className="live-label">
          {live ? "Gemini connected — it reads the question and words the reply" : "Offline mode — deterministic parser"}
        </span>
        <span className="live-note">Numbers always come from the simulation</span>
        {live ? (
          <button
            className="link-btn"
            onClick={() => {
              setKey("");
              setLive(false);
            }}
          >
            Disconnect
          </button>
        ) : (
          <button className="link-btn" onClick={() => setShowKey((v) => !v)}>
            Connect Gemini
          </button>
        )}
      </div>
      {showKey && !live && (
        <form
          className="key-row"
          onSubmit={(e) => {
            e.preventDefault();
            setKey(keyDraft.trim());
            setLive(isLive());
            setKeyDraft("");
            setShowKey(false);
          }}
        >
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="Paste a Gemini API key — held in this tab only, never saved to the repo"
            aria-label="Gemini API key"
          />
          <button className="cta" type="submit">
            Connect
          </button>
        </form>
      )}

      <div className="chat-feed" ref={feedRef}>
        {turns.length === 0 && (
          <div className="empty">
            <p>Try one of these:</p>
            <div className="chips">
              {OPENERS.map((o) => (
                <button key={o} className="chip-btn" onClick={() => send(o)}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div className="turn" key={i}>
            <div className="msg-user">{t.q}</div>
            <AnswerCard a={t.a} />
            {t.live && <div className="live-tag">Wording by Gemini · figures from the simulation</div>}
          </div>
        ))}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about a card launch, a limit change, or a macro path…"
          aria-label="Ask the model a question"
        />
        <button className="cta" type="submit" disabled={busy}>
          {busy ? "Running…" : "Run it"}
        </button>
      </form>
    </div>
  );
}
