import { useEffect, useRef, useState } from "react";
import type { Band } from "../engine/paths";
import { monthLabel, usd } from "../engine/format";

type Series = { baseline: number[]; intervention: number[] };

/**
 * Measure the rendered width so the viewBox can be set in real pixels.
 * A fixed viewBox scales its own text, which leaves axis labels unreadable in
 * any container narrower than the one the chart was designed for.
 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setW(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function LineChart({
  series,
  bands,
  format = "usd",
  height = 200,
}: {
  series: Series;
  /** p10–p90 envelopes drawn behind each line. */
  bands?: { baseline?: Band; intervention?: Band };
  format?: "usd" | "pct";
  height?: number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = height;
  const pad = { l: 54, r: 12, t: 12, b: 28 };
  const innerW = Math.max(10, w - pad.l - pad.r);
  const innerH = h - pad.t - pad.b;
  const n = Math.max(series.baseline.length, 1);

  const all = [
    ...series.baseline,
    ...series.intervention,
    ...(bands?.baseline?.p10 ?? []),
    ...(bands?.baseline?.p90 ?? []),
    ...(bands?.intervention?.p10 ?? []),
    ...(bands?.intervention?.p90 ?? []),
  ];
  let min = Math.min(...all);
  let max = Math.max(...all, min + 1e-6);
  const yPad = (max - min) * 0.1 || Math.abs(max) * 0.04 || 1;
  if (format === "pct") {
    min = 0;
    max += yPad;
  } else {
    min -= yPad;
    max += yPad;
  }
  const span = max - min || 1;
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * innerW;
  const y = (v: number) => pad.t + (1 - (v - min) / span) * innerH;
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = (b: Band) => {
    const top = b.p90.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const bottom = b.p10
      .map((v, i) => ({ v, i }))
      .reverse()
      .map(({ v, i }) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    return [...top, ...bottom, "Z"].join(" ");
  };

  const ticks = 4;
  const fmt = (v: number) => (format === "pct" ? `${(v * 100).toFixed(1)}%` : usd(v));
  // Label every month when there is room, thinning out as the chart narrows.
  const every = innerW > 460 ? 3 : innerW > 280 ? 4 : 6;

  return (
    <div ref={ref} className="chart-host">
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img">
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = min + (span * i) / ticks;
          const yy = y(v);
          return (
            <g key={i}>
              <line className="grid" x1={pad.l} x2={w - pad.r} y1={yy} y2={yy} />
              <text className="axis" x={pad.l - 8} y={yy + 3} textAnchor="end">
                {fmt(v)}
              </text>
            </g>
          );
        })}
        {series.baseline.map((_, i) =>
          i % every === 0 ? (
            <text key={i} className="axis" x={x(i)} y={h - 6} textAnchor="middle">
              {monthLabel(i)}
            </text>
          ) : null,
        )}
        {bands?.baseline && <path className="band base" d={area(bands.baseline)} />}
        {bands?.intervention && <path className="band int" d={area(bands.intervention)} />}
        <path className="base" d={path(series.baseline)} />
        <path className="int" d={path(series.intervention)} />
      </svg>
    </div>
  );
}

/**
 * Policy sweep: value against the setting of a lever, with the optimum marked.
 * Answers "what should we do", which a single counterfactual cannot.
 */
export function SweepChart({
  points,
  best,
  current,
  height = 210,
}: {
  points: { limitDelta: number; ltvPerHousehold: number }[];
  best: { limitDelta: number; ltvPerHousehold: number };
  current: number;
  height?: number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = height;
  const pad = { l: 54, r: 14, t: 14, b: 34 };
  const innerW = Math.max(10, w - pad.l - pad.r);
  const innerH = h - pad.t - pad.b;
  if (points.length === 0) return <div ref={ref} className="chart-host" />;

  const xs = points.map((p) => p.limitDelta);
  const ys = points.map((p) => p.ltvPerHousehold);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys) * 0.96;
  const yMax = Math.max(...ys) * 1.04;
  const X = (v: number) => pad.l + ((v - xMin) / (xMax - xMin || 1)) * innerW;
  const Y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.limitDelta).toFixed(1)},${Y(p.ltvPerHousehold).toFixed(1)}`).join(" ");

  return (
    <div ref={ref} className="chart-host">
      <svg className="chart" viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img"
        aria-label={`Lifetime value per household against credit line change. Best at ${Math.round(best.limitDelta * 100)} percent.`}>
        {Array.from({ length: 4 }, (_, i) => {
          const v = yMin + ((yMax - yMin) * i) / 3;
          return (
            <g key={i}>
              <line className="grid" x1={pad.l} x2={w - pad.r} y1={Y(v)} y2={Y(v)} />
              <text className="axis" x={pad.l - 8} y={Y(v) + 3} textAnchor="end">{usd(v)}</text>
            </g>
          );
        })}
        {points.map((p, i) =>
          i % 2 === 0 ? (
            <text key={p.limitDelta} className="axis" x={X(p.limitDelta)} y={h - 8} textAnchor="middle">
              {Math.round(p.limitDelta * 100)}%
            </text>
          ) : null,
        )}
        <line className="marker-now" x1={X(current)} x2={X(current)} y1={pad.t} y2={pad.t + innerH} />
        <path className="sweep" d={d} />
        <circle className="peak" cx={X(best.limitDelta)} cy={Y(best.ltvPerHousehold)} r={5} />
        <text className="peak-label" x={X(best.limitDelta)} y={Y(best.ltvPerHousehold) - 12} textAnchor="middle">
          best {Math.round(best.limitDelta * 100)}%
        </text>
      </svg>
    </div>
  );
}
