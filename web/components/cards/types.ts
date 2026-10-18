// The card contract, hand-copied from agent/buddy/cards/schema.py (docs/specs/card-contract.md).
// Change both together.

export type Renderer = "rank" | "scatter" | "table" | "composite";
export type Scale = "fixed_0_100" | "zoomed" | "log" | "linear" | "percentile" | "categorical";
export type ValueDirection = "lower_is_better" | "higher_is_better" | "higher_means_more_exposure" | "categorical";
export type Corner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
export type SupplierFlag = "best" | "worst" | "outlier" | "hidden_watchout" | "recommended";

export type ReferenceBand = { label: string; min: number; max: number };

export type Quadrants = {
  x: string;
  y: string;
  xThreshold: number;
  yThreshold: number;
  labels: Record<Corner, string>;
  goodZone: Corner;
};

export type CardSupplier = {
  supplierID: string;
  supplierName: string;
  values: Record<string, number | string>;
  levels: Record<string, string>;
  flags: string[];
};

export type HiddenWatchout = { supplierID: string; totalRisk: number; metric: string; value: number };

export type Card = {
  cardId: string;
  renderer: Renderer;
  template: string;
  title: string;
  intent: "compare" | "overview" | "watchlist" | "exposure" | "choose";
  direction: "safest" | "watch";
  metrics: string[];
  metricLabels: Record<string, string>;
  valueDirection: Record<string, ValueDirection>;
  sort: { field: string; direction: "asc" | "desc" };
  dataShape: { flags: string[]; scale: Scale; fallbackApplied: string | null; notes: string[] };
  referenceBands: ReferenceBand[];
  quadrants: Quadrants | null;
  suppliers: CardSupplier[];
  facts: Record<string, unknown> & { hiddenWatchouts?: HiddenWatchout[] };
  summary: string;
  panels?: Card[] | null; // composite only: one full card per buyer topic
};

export type ToolResult = {
  status: "ok" | "needs_clarification" | "error";
  card?: Card;
  summary?: string;
  question?: string;
  options?: string[];
  message?: string;
};
