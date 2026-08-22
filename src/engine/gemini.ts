/**
 * Optional Gemini bridge.
 *
 * Gemini is used for two jobs only: understanding a free-text question, and
 * wording the reply. It never produces a number. Every figure in an answer comes
 * out of the simulation, which runs after the question has been parsed. If the
 * bridge is not configured, or the call fails, the deterministic parser answers
 * instead and the product still works.
 *
 * The key is never committed. It is either held in sessionStorage for the tab,
 * or — the right way for a deployed build — kept server-side behind a proxy and
 * never sent to the browser at all.
 */

const KEY_STORE = "wmb.gemini.key";
const MODEL = "gemini-2.0-flash";

/** A proxy endpoint that holds the key server-side. Preferred for anything deployed. */
const PROXY: string | undefined = import.meta.env?.VITE_GEMINI_PROXY;

export type ScenarioSpec = {
  intent: "launch" | "line" | "macro" | "other";
  category?: string;
  bps?: number;
  limitDeltaPct?: number;
  segment?: string;
  inflationPct?: number;
  unemploymentPct?: number;
  asksAboutMisuse?: boolean;
};

export function getKey(): string {
  try {
    return sessionStorage.getItem(KEY_STORE) ?? "";
  } catch {
    return "";
  }
}

export function setKey(k: string): void {
  try {
    if (k) sessionStorage.setItem(KEY_STORE, k);
    else sessionStorage.removeItem(KEY_STORE);
  } catch {
    /* private mode — the bridge simply stays off */
  }
}

export function isLive(): boolean {
  return Boolean(PROXY || getKey());
}

async function call(body: unknown): Promise<string | null> {
  const key = getKey();
  let url: string;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (PROXY) {
    url = PROXY;
  } else if (key.startsWith("AIza")) {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  } else if (key) {
    // OAuth-style token
    url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    headers.Authorization = `Bearer ${key}`;
  } else {
    return null;
  }

  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const text: unknown = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

const PARSE_PROMPT = `You route questions from bank strategists to a household simulator.
Return ONLY minified JSON matching this shape, no prose, no code fence:
{"intent":"launch|line|macro|other","category":"groceries|restaurants|retail|gas|health|entertainment|travel|transit|subscriptions|auto|telecom","bps":number,"limitDeltaPct":number,"segment":"transactor|prime_revolver|near_prime|subprime|gig","inflationPct":number,"unemploymentPct":number,"asksAboutMisuse":boolean}
Rules:
- "launch" = any reward, cashback, co-brand, points or category-multiplier question. bps is the reward in basis points (5% -> 500).
- Amusement parks, theme parks, cinemas and attractions map to category "entertainment". Flights, miles, hotels map to "travel".
- "line" = credit limit changes. limitDeltaPct is signed (a 20% cut -> -20).
- "macro" = inflation, unemployment, recession or stress questions.
- asksAboutMisuse is true when the question asks whether a product will be used as intended, gamed, farmed, arbitraged or abused.
- Omit fields you cannot infer. If the question is not about any of these, use intent "other".
Question: `;

export async function parseQuestion(q: string): Promise<ScenarioSpec | null> {
  const text = await call({
    contents: [{ parts: [{ text: PARSE_PROMPT + JSON.stringify(q) }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 220, responseMimeType: "application/json" },
  });
  if (!text) return null;
  try {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const spec = JSON.parse(cleaned) as ScenarioSpec;
    return spec && typeof spec.intent === "string" ? spec : null;
  } catch {
    return null;
  }
}

/**
 * Re-words an answer for the reader. The figures are passed in already computed;
 * the prompt forbids inventing or altering any of them.
 */
export async function narrate(args: {
  question: string;
  title: string;
  facts: string[];
  fallback: string;
}): Promise<string> {
  const text = await call({
    contents: [
      {
        parts: [
          {
            text: `You explain simulation output to a bank strategist or marketer.
Write 2-4 sentences of plain English answering the question directly.
Absolute rules: use ONLY the figures listed below; never invent, round differently, or add any number that is not listed; no bullet points; no preamble; no markdown.
If the figures show the policy loses money, say so plainly.

Question: ${args.question}
Scenario: ${args.title}
Figures:
${args.facts.map((f) => `- ${f}`).join("\n")}`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.4, maxOutputTokens: 320 },
  });
  return text?.trim() || args.fallback;
}
