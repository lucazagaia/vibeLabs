// Cards built in the browser from the CSV rows, so a Comparison Pool widget is drawn by the same
// renderers as a card the agent puts on the dashboard. Mirrors the single-metric path of
// agent/buddy/cards/route.py + preflight.py; keep the two in step.

import { metricSpec, rawValue, type Supplier } from "../supplierMetrics";
import type { Card, CardSupplier, Scale, ValueDirection } from "./types";

const SPEND = "Purchase Order Volume (EUR)";
const PERCENT = new Set(["Supplier Delivery Rating", "Order Confirmation Rate", "Order Change Rate"]);
const CATEGORICAL = new Set(["Sourcing Risk Level", "Supply Chain Complexity"]);

const REFERENCE_BANDS = [
  { label: "Low", min: 0, max: 24 },
  { label: "Medium", min: 25, max: 49 },
  { label: "High", min: 50, max: 74 },
  { label: "Critical", min: 75, max: 100 },
];

export function valueDirectionOf(metric: string): ValueDirection {
  if (CATEGORICAL.has(metric)) return "categorical";
  if (metric === SPEND) return "higher_means_more_exposure";
  if (metric === "Supplier Delivery Rating" || metric === "Order Confirmation Rate") return "higher_is_better";
  return "lower_is_better";
}

function scaleOf(metric: string, values: number[]): Scale {
  if (CATEGORICAL.has(metric)) return "categorical";
  if (metric === SPEND) return Math.max(...values) / Math.max(Math.min(...values), 1) > 3 ? "log" : "linear";
  if (PERCENT.has(metric)) return "linear";
  return "fixed_0_100";
}

function templateOf(metric: string): string {
  if (CATEGORICAL.has(metric)) return "pool_category_card";
  if (metric === SPEND) return "log_exposure_bar_card";
  return "ranked_lollipop_card";
}

function formatScore(metric: string, score: number) {
  if (metric === SPEND) return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(score);
  if (PERCENT.has(metric)) return `${score.toFixed(1)}%`;
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/** One card for `metric` over `pooled`. Null when no pooled supplier reports the metric. */
export function buildLocalCard(metric: string, pooled: Supplier[], cardId: string): Card | null {
  const spec = metricSpec(metric);
  const direction = valueDirectionOf(metric);
  const categorical = direction === "categorical";

  // A score of 0 is not reported, so those suppliers stay off the chart and are named in the notes.
  const reported = pooled.filter((supplier) => (categorical ? Boolean(supplier[metric]?.trim()) : rawValue(supplier, metric) !== null));
  if (reported.length === 0) return null;
  const missing = pooled.length - reported.length;

  const numbers = categorical ? [] : reported.map((supplier) => rawValue(supplier, metric) as number);
  const bestFirstAscending = direction === "lower_is_better";
  const sorted = categorical
    ? reported
    : [...reported].sort((a, b) => ((rawValue(a, metric) as number) - (rawValue(b, metric) as number)) * (bestFirstAscending ? 1 : -1));

  const suppliers: CardSupplier[] = sorted.map((supplier, index) => ({
    supplierID: supplier.supplierID,
    supplierName: supplier["Supplier Name"],
    values: { [metric]: categorical ? supplier[metric] : (rawValue(supplier, metric) as number) },
    levels: supplier[`${metric}_Level`] ? { [`${metric}_Level`]: supplier[`${metric}_Level`] } : {},
    flags: categorical || sorted.length < 2 ? [] : index === 0 ? ["best"] : index === sorted.length - 1 ? ["worst"] : [],
  }));

  const notes = missing > 0 ? [`${missing} pooled supplier${missing === 1 ? "" : "s"} do not report ${spec.label.toLowerCase()} and are left out.`] : [];

  return {
    cardId,
    renderer: categorical ? "table" : "rank",
    template: templateOf(metric),
    title: spec.label,
    intent: "compare",
    direction: "safest",
    metrics: [metric],
    metricLabels: { [metric]: spec.label },
    valueDirection: { [metric]: direction },
    sort: { field: metric, direction: bestFirstAscending ? "asc" : "desc" },
    dataShape: { flags: [], scale: scaleOf(metric, numbers.length ? numbers : [0]), fallbackApplied: null, notes },
    referenceBands: REFERENCE_BANDS,
    quadrants: null,
    suppliers,
    facts: {},
    summary: summarize(metric, spec.label, direction, suppliers, pooled.length),
  };
}

function summarize(metric: string, label: string, direction: ValueDirection, suppliers: CardSupplier[], pooledCount: number) {
  const scope = `${suppliers.length} of ${pooledCount} pooled supplier${pooledCount === 1 ? "" : "s"}`;
  if (direction === "categorical" || suppliers.length < 2) return `${label} across ${scope}.`;
  const first = suppliers[0];
  const last = suppliers[suppliers.length - 1];
  const firstValue = formatScore(metric, first.values[metric] as number);
  const lastValue = formatScore(metric, last.values[metric] as number);
  if (direction === "higher_means_more_exposure") {
    return `${first.supplierName} carries the largest exposure (${firstValue}) and ${last.supplierName} the smallest (${lastValue}) across ${scope}.`;
  }
  const better = direction === "lower_is_better" ? "lowest" : "highest";
  const worse = direction === "lower_is_better" ? "highest" : "lowest";
  return `${first.supplierName} has the ${better} ${label.toLowerCase()} (${firstValue}) and ${last.supplierName} the ${worse} (${lastValue}) across ${scope}.`;
}
