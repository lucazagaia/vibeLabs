"use client";

import { useEffect, useRef, useState } from "react";

import { directionHint, formatValue, makeAxis, shortId, type Axis } from "./bands";
import type { Card, CardSupplier, Corner } from "./types";

const M = { top: 14, right: 14, bottom: 44, left: 46 };
const PAD = 12;
const FONT = 11;
const ZONE_FILL = { good: "#10b981", concern: "#dc2626", other: "#f59e0b" } as const;

type Point = { s: CardSupplier; x: number; y: number; r: number; zone: keyof typeof ZONE_FILL; label: string };
type Box = { x: number; y: number; w: number; h: number };

/** Two metrics against each other, split into quadrants at the card's thresholds. */
export function ScatterCard({ card, preview = false }: { card: Card; preview?: boolean }) {
  const [ref, width] = useWidth();
  const q = card.quadrants;
  if (!q) return null;

  const xs = card.suppliers.map((s) => s.values[q.x] as number);
  const ys = card.suppliers.map((s) => s.values[q.y] as number);
  const ax = makeAxis(card.dataShape.scale, q.x, xs, [q.xThreshold]);
  const ay = makeAxis(card.dataShape.scale, q.y, ys, [q.yThreshold]);
  const sizeMetric = card.metrics.find((m) => m !== q.x && m !== q.y && typeof card.suppliers[0]?.values[m] === "number");
  const concern = (card.facts.quadrant as { concernZone?: Corner } | undefined)?.concernZone;

  const height = preview ? Math.round(Math.min(190, Math.max(130, width * 0.5))) : Math.round(Math.min(420, Math.max(260, width * 0.62)));
  const pw = Math.max(1, width - M.left - M.right);
  const ph = height - M.top - M.bottom;
  // Inner padding keeps dots at 0 or 100 (and their size) inside the plot frame.
  const px = (v: number) => M.left + PAD + clamp(ax.pos(v)) * (pw - 2 * PAD);
  const py = (v: number) => M.top + PAD + (1 - clamp(ay.pos(v))) * (ph - 2 * PAD);

  const quadrantLabels = (Object.keys(q.labels) as Corner[]).map((c) => quadrantLabelBox(c, q.labels[c], pw, ph));
  const points = width ? layoutPoints(card, q, px, py, sizeMetric, concern) : [];
  const labels = width && !preview ? placeLabels(points, { x: M.left, y: M.top, w: pw, h: ph }, quadrantLabels) : new Map<string, Box>();
  const hidden = points.length - labels.size;
  const corner = (c: Corner): Box => ({
    x: c.endsWith("Left") ? M.left : px(q.xThreshold),
    y: c.startsWith("top") ? M.top : py(q.yThreshold),
    w: c.endsWith("Left") ? px(q.xThreshold) - M.left : M.left + pw - px(q.xThreshold),
    h: c.startsWith("top") ? py(q.yThreshold) - M.top : M.top + ph - py(q.yThreshold),
  });

  return (
    <div ref={ref} className="min-w-0">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={card.title} className="block overflow-visible">
          {/* zones and thresholds */}
          {([["good", q.goodZone], ["concern", concern]] as const).map(([kind, c]) =>
            c ? <rect key={kind} {...toRect(corner(c))} fill={ZONE_FILL[kind]} opacity={kind === "good" ? 0.08 : 0.07} /> : null,
          )}
          <Grid ax={ax} ay={ay} px={px} py={py} pw={pw} ph={ph} />
          <line x1={px(q.xThreshold)} x2={px(q.xThreshold)} y1={M.top} y2={M.top + ph} className="stroke-black/35 dark:stroke-white/35" strokeDasharray="4 3" />
          <line x1={M.left} x2={M.left + pw} y1={py(q.yThreshold)} y2={py(q.yThreshold)} className="stroke-black/35 dark:stroke-white/35" strokeDasharray="4 3" />
          {!preview && (Object.keys(q.labels) as Corner[]).map((c) => (
            <text
              key={c}
              x={c.endsWith("Left") ? M.left + 6 : M.left + pw - 6}
              y={c.startsWith("top") ? M.top + 13 : M.top + ph - 5}
              textAnchor={c.endsWith("Left") ? "start" : "end"}
              fontSize={10}
              fontWeight={c === q.goodZone || c === concern ? 600 : 400}
              className="fill-black/45 dark:fill-white/45"
            >
              {q.labels[c]}
            </text>
          ))}
          {/* axes titles */}
          {!preview && <text x={M.left + pw / 2} y={height - 6} textAnchor="middle" fontSize={FONT} className="fill-black/60 dark:fill-white/60">
            {card.metricLabels[q.x]} ({directionHint(card, q.x)}) →
          </text>}
          {!preview && <text
            transform={`translate(12 ${M.top + ph / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={FONT}
            className="fill-black/60 dark:fill-white/60"
          >
            {card.metricLabels[q.y]} ({directionHint(card, q.y)}) →
          </text>}
          {/* points, then labels on top */}
          {points.map((p) => (
            <circle
              key={p.s.supplierID}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={ZONE_FILL[p.zone]}
              fillOpacity={0.85}
              stroke={p.s.flags.includes("hidden_watchout") ? "#d97706" : p.s.flags.includes("outlier") ? "#8b5cf6" : "white"}
              strokeWidth={p.s.flags.some((f) => f === "hidden_watchout" || f === "outlier") ? 2.5 : 1}
              className="dark:stroke-neutral-900"
            >
              <title>{tooltip(card, p.s)}</title>
            </circle>
          ))}
          {points.map((p) => {
            const b = labels.get(p.s.supplierID);
            return b ? (
              <text key={p.s.supplierID} x={b.x + 1} y={b.y + b.h - 2} fontSize={FONT} className="pointer-events-none fill-black/75 font-mono dark:fill-white/80">
                {p.label}
              </text>
            ) : null;
          })}
        </svg>
      )}
      {!width && <div style={{ height: preview ? 150 : 300 }} />}
      {!preview && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-black/50 dark:text-white/50">
        <Legend color={ZONE_FILL.good} text={q.labels[q.goodZone]} />
        {concern && <Legend color={ZONE_FILL.concern} text={q.labels[concern]} />}
        <Legend color={ZONE_FILL.other} text="Mixed" />
        {sizeMetric && <span>Dot size: {card.metricLabels[sizeMetric].toLowerCase()} ({directionHint(card, sizeMetric)})</span>}
        {hidden > 0 && <span>{hidden} label{hidden > 1 ? "s" : ""} hidden to avoid overlap · hover a dot</span>}
      </div>}
    </div>
  );
}

function layoutPoints(
  card: Card,
  q: NonNullable<Card["quadrants"]>,
  px: (v: number) => number,
  py: (v: number) => number,
  sizeMetric: string | undefined,
  concern: Corner | undefined,
): Point[] {
  const sizes = sizeMetric ? card.suppliers.map((s) => s.values[sizeMetric] as number) : [];
  const [lo, hi] = [Math.min(...sizes), Math.max(...sizes)];
  const points: Point[] = card.suppliers.map((s) => {
    const vx = s.values[q.x] as number;
    const vy = s.values[q.y] as number;
    const c: Corner = `${vy >= q.yThreshold ? "top" : "bottom"}${vx >= q.xThreshold ? "Right" : "Left"}`;
    const r = sizeMetric ? 4 + 7 * Math.sqrt(((s.values[sizeMetric] as number) - lo) / (hi - lo || 1)) : 5.5;
    return { s, x: px(vx), y: py(vy), r, zone: c === q.goodZone ? "good" : c === concern ? "concern" : "other", label: shortId(s.supplierID) };
  });
  // Deterministic jitter: points on the same pixel are spread on a small circle, ordered by supplier ID.
  const groups = new Map<string, Point[]>();
  for (const p of points) {
    const key = `${Math.round(p.x / 3)}:${Math.round(p.y / 3)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.s.supplierID.localeCompare(b.s.supplierID));
    group.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / group.length + hash(p.s.supplierID) * 0.5;
      p.x += Math.cos(angle) * (p.r + 2);
      p.y += Math.sin(angle) * (p.r + 2);
    });
  }
  return points;
}

function quadrantLabelBox(c: Corner, text: string, pw: number, ph: number): Box {
  const w = text.length * 5.6 + 4;
  return { x: c.endsWith("Left") ? M.left + 4 : M.left + pw - 4 - w, y: c.startsWith("top") ? M.top + 2 : M.top + ph - 16, w, h: 14 };
}

/** Greedy label placement: flagged suppliers first, 8 candidate spots each, skip if nothing fits. */
function placeLabels(points: Point[], plot: Box, obstacles: Box[]): Map<string, Box> {
  const placed = new Map<string, Box>();
  const taken: Box[] = [...points.map((p) => ({ x: p.x - p.r, y: p.y - p.r, w: 2 * p.r, h: 2 * p.r })), ...obstacles];
  const order = [...points].sort((a, b) => Number(b.s.flags.length > 0) - Number(a.s.flags.length > 0));
  for (const p of order) {
    const w = p.label.length * 6.6 + 2;
    const h = FONT + 2;
    const g = p.r + 3;
    const spots: Box[] = [
      { x: p.x + g, y: p.y - h / 2, w, h },
      { x: p.x - g - w, y: p.y - h / 2, w, h },
      { x: p.x - w / 2, y: p.y - g - h, w, h },
      { x: p.x - w / 2, y: p.y + g, w, h },
      { x: p.x + g * 0.7, y: p.y - g - h * 0.6, w, h },
      { x: p.x + g * 0.7, y: p.y + g * 0.6, w, h },
      { x: p.x - g * 0.7 - w, y: p.y - g - h * 0.6, w, h },
      { x: p.x - g * 0.7 - w, y: p.y + g * 0.6, w, h },
    ];
    const own = taken[points.indexOf(p)];
    const spot = spots.find((b) => inside(b, plot) && !taken.some((t) => t !== own && overlaps(b, t)));
    if (spot) {
      placed.set(p.s.supplierID, spot);
      taken.push(spot);
    }
  }
  return placed;
}

function Grid({ ax, ay, px, py, pw, ph }: { ax: Axis; ay: Axis; px: (v: number) => number; py: (v: number) => number; pw: number; ph: number }) {
  return (
    <g fontSize={10} className="fill-black/40 dark:fill-white/40">
      <rect x={M.left} y={M.top} width={pw} height={ph} fill="none" className="stroke-black/10 dark:stroke-white/15" />
      {ax.ticks.map((t) => (
        <g key={`x${t}`}>
          <line x1={px(t)} x2={px(t)} y1={M.top} y2={M.top + ph} className="stroke-black/[0.06] dark:stroke-white/[0.08]" />
          <text x={px(t)} y={M.top + ph + 14} textAnchor="middle">{ax.format(t)}</text>
        </g>
      ))}
      {ay.ticks.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.left} x2={M.left + pw} y1={py(t)} y2={py(t)} className="stroke-black/[0.06] dark:stroke-white/[0.08]" />
          <text x={M.left - 6} y={py(t) + 3} textAnchor="end">{ay.format(t)}</text>
        </g>
      ))}
    </g>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {text}
    </span>
  );
}

function tooltip(card: Card, s: CardSupplier) {
  const values = card.metrics.map((m) => `${card.metricLabels[m]}: ${formatValue(m, s.values[m])}`).join("\n");
  return `${s.supplierID} · ${s.supplierName}\n${values}`;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const toRect = (b: Box) => ({ x: b.x, y: b.y, width: Math.max(0, b.w), height: Math.max(0, b.h) });
const inside = (b: Box, o: Box) => b.x >= o.x && b.y >= o.y && b.x + b.w <= o.x + o.w && b.y + b.h <= o.y + o.h;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const clamp = (x: number) => Math.min(1, Math.max(0, x));

function hash(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h / 997;
}
