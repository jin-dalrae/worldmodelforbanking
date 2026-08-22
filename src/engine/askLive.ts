import { ask } from "./ask";
import { isLive, narrate, parseQuestion, type ScenarioSpec } from "./gemini";
import type { Agent, Answer, Macro } from "./types";

/**
 * Question -> answer, with Gemini in the loop when it is configured.
 *
 * Order of operations matters. Gemini only turns the question into a scenario;
 * the simulator then runs that scenario and produces every number; Gemini is
 * finally handed those numbers and asked to word them. It is never asked what
 * the answer is. Any failure at any step falls back to the deterministic path,
 * so the demo never depends on the network.
 */

type Ctx = { agents: Agent[]; months: number; macro: Macro; seed: number };

/** Rebuild a phrasing the deterministic parser is guaranteed to understand. */
function canonical(spec: ScenarioSpec, original: string): string | null {
  const misuse = spec.asksAboutMisuse ? " will they use it as intended or game it" : "";
  switch (spec.intent) {
    case "launch": {
      if (!spec.category) return null;
      const bps = Number.isFinite(spec.bps) ? Math.max(0, Math.round(spec.bps as number)) : 500;
      return `launch a ${bps}bps rewards card on ${spec.category}${misuse}`;
    }
    case "line": {
      const pct = Number.isFinite(spec.limitDeltaPct) ? (spec.limitDeltaPct as number) : -20;
      const verb = pct >= 0 ? "raise" : "cut";
      const seg = spec.segment ? ` for ${spec.segment.replace(/_/g, " ")}` : "";
      return `${verb} the credit line ${Math.abs(pct)}%${seg}`;
    }
    case "macro": {
      const bits: string[] = [];
      if (Number.isFinite(spec.inflationPct)) bits.push(`inflation ${spec.inflationPct}%`);
      if (Number.isFinite(spec.unemploymentPct)) bits.push(`unemployment ${spec.unemploymentPct}%`);
      return bits.length ? `stress ${bits.join(" and ")}` : "recession stress";
    }
    default:
      return original;
  }
}

export async function askLive(question: string, ctx: Ctx): Promise<{ answer: Answer; live: boolean }> {
  const offline = ask(question, ctx);
  if (!isLive()) return { answer: offline, live: false };

  const spec = await parseQuestion(question);
  if (!spec) return { answer: offline, live: false };

  // Gemini understood the question: re-run through the engine on its reading.
  const phrase = canonical(spec, question);
  const answer = phrase ? ask(phrase, ctx) : offline;
  if (answer.kind !== "result") return { answer, live: true };

  // Hand back only what the engine computed, and let Gemini word it.
  const facts = answer.metrics.map((m) => `${m.label}: ${m.value}`);
  if (answer.split) {
    const total = answer.split.parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
    for (const p of answer.split.parts) {
      facts.push(`${p.label}: ${Math.round((Math.max(0, p.value) / total) * 100)}% of the extra volume`);
    }
  }
  if (answer.footnote) facts.push(answer.footnote);

  const prose = await narrate({
    question,
    title: answer.title,
    facts,
    fallback: answer.prose,
  });

  return { answer: { ...answer, prose }, live: true };
}
