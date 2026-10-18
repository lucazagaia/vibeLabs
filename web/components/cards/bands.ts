// Colours, scales and number formats shared by the three renderers. They only *draw* what the card says:
// levels come from the card (or its referenceBands), never recomputed from other data.

import type { Card, CardSupplier, Scale } from "./types";

export type Level = "Low" | "Medium" | "High" | "Critical";

const SPEND = "Purchase Order Volume (EUR)";
const PERCENT = new Set(["Supplier Delivery Rating", "Order Confirmation Rate", "Order Change Rate"]);

// Full class strings so Tailwind sees them. Muted fills + readable text in both themes.
export const LEVEL_CELL: Record<Level, string> = {
  Low: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
  Medium: "bg-amber-400/20 text-amber-900 dark:text-amber-200",
  High: "bg-orange-500/25 text-orange-950 dark:text-orange-200",
  Critical: "bg-red-600/30 text-red-950 dark:text-red-100",
};
export const LEVEL_DOT: Record<Level, string> = {
  Low: "bg-emerald-500",
  Medium: "bg-amber-400",
  High: "bg-orange-500",
  Critical: "bg-red-600",
};
export const LEVEL_FILL: Record<Level, string> = {
  Low: "#10b981",
  Medium: "#fbbf24",
  High: "#f97316",
  Critical: "#dc2626",
};
export const NEUTRAL_FILL = "#64748b";

const CATEGORY_LEVEL: Record<string, Level> = {
  Low: "Low", Medium: "Medium", High: "High",
  Simple: "Low", Moderate: "Medium", Complex: "High",
};

export function isPercent(metric: string) {
  return PERCENT.has(metric);
}

/** The level for one cell: the data's own `_Level`, else the card's reference bands for 0–100 risk scores. */
export function levelOf(card: Card, s: CardSupplier, metric: string): Level | null {
  const own = s.levels[`${metric}_Level`];
  if (own) return own as Level;
  const v = s.values[metric];
  if (typeof v === "string") return CATEGORY_LEVEL[v] ?? null;
  if (card.valueDirection[metric] !== "lower_is_better" || isPercent(metric)) return null;
  const band = card.referenceBands.find((b) => v >= b.min && v <= b.max + 0.999);
  return (band?.label as Level) ?? null;
}

export function formatValue(metric: string, v: number | string | undefined): string {
  if (v === undefined) return "–";
  if (typeof v === "string") return v;
  if (metric === SPEND) return `€${compact(v)}`;
  if (isPercent(metric)) return `${v.toFixed(1)}%`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function compact(v: number): string {
  const trim = (x: string) => x.replace(/\.0$/, "");
  if (v >= 1e6) return `${trim((v / 1e6).toFixed(v >= 1e7 ? 0 : 1))}M`;
  if (v >= 1e3) return `${trim((v / 1e3).toFixed(v >= 1e4 ? 0 : 1))}k`;
  return v.toFixed(0);
}

export function directionHint(card: Card, metric: string): string {
  switch (card.valueDirection[metric]) {
    case "lower_is_better": return "lower is better";
    case "higher_is_better": return "higher is better";
    case "higher_means_more_exposure": return "exposure, not risk";
    default: return "";
  }
}

/** Maps a value to 0..1 along an axis. Domains: 0–100 for risk scores, padded min–max for percentages, decades for log. */
export type Axis = { kind: "fixed" | "linear" | "log"; pos: (v: number) => number; ticks: number[]; format: (v: number) => string };

export function makeAxis(scale: Scale, metric: string, values: number[], extra: number[] = []): Axis {
  const fmt = (v: number) => formatValue(metric, v);
  if (scale === "log" || metric === SPEND) {
    const lo = Math.floor(Math.log10(Math.max(1, Math.min(...values))));
    const hi = Math.ceil(Math.log10(Math.max(...values) + 1));
    const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => 10 ** (lo + i));
    return { kind: "log", pos: (v) => (Math.log10(Math.max(v, 10 ** lo)) - lo) / (hi - lo || 1), ticks, format: fmt };
  }
  if (scale === "linear" || scale === "zoomed" || isPercent(metric)) {
    const all = [...values, ...extra];
    const span = Math.max(...all) - Math.min(...all) || 1;
    const step = niceStep(span / 4);
    const lo = Math.max(0, Math.floor((Math.min(...all) - span * 0.08) / step) * step);
    const hi = Math.min(isPercent(metric) ? 100 : Infinity, Math.ceil((Math.max(...all) + span * 0.08) / step) * step);
    const ticks: number[] = [];
    for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(Number(t.toFixed(6)));
    return { kind: "linear", pos: (v) => (v - lo) / (hi - lo || 1), ticks, format: fmt };
  }
  return { kind: "fixed", pos: (v) => v / 100, ticks: [0, 25, 50, 75, 100], format: fmt };
}

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function shortId(id: string) {
  return id.replace(/^SUPP_0*/, "#");
}
