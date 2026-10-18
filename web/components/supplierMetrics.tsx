"use client";

export type Supplier = Record<string, string> & { supplierID: string; "Supplier Name": string };

export type MetricSpec = {
  key: string;
  label: string;
  suffix?: string;
  // Risk scores and exposure read better when they are low; ratings read better when they are high.
  lowerIsBetter?: boolean;
};

export const RISK_METRICS: MetricSpec[] = [
  { key: "Total_Risk_Index", label: "Total Risk Index", lowerIsBetter: true },
  { key: "Industry_Benchmark_Score", label: "Industry benchmark", lowerIsBetter: true },
  { key: "Media_Sentiment_Score", label: "Media sentiment", lowerIsBetter: true },
  { key: "External_Intelligence_Score", label: "External intelligence", lowerIsBetter: true },
  { key: "Sub_Tier_Visibility_Score", label: "Sub-tier visibility", lowerIsBetter: true },
  { key: "Labor_Stability_Score", label: "Labor stability", lowerIsBetter: true },
  { key: "Financial_Health_Score", label: "Financial health", lowerIsBetter: true },
  { key: "Compliance_Risk_Score", label: "Compliance risk", lowerIsBetter: true },
  { key: "Safety_Incident_Score", label: "Safety incidents", lowerIsBetter: true },
  { key: "Environmental_Exposure_Score", label: "Environmental exposure", lowerIsBetter: true },
  { key: "ESG_Performance_Score", label: "ESG performance", lowerIsBetter: true },
  { key: "Digital_Security_Score", label: "Digital security", lowerIsBetter: true },
  { key: "Operational_Resilience_Score", label: "Operational resilience", lowerIsBetter: true },
  { key: "Market_Sentiment_Score", label: "Market sentiment", lowerIsBetter: true },
  { key: "Quality_Risk_Score", label: "Quality risk", lowerIsBetter: true },
  { key: "Governance_Risk_Score", label: "Governance risk", lowerIsBetter: true },
  { key: "Geopolitical_Risk_Score", label: "Geopolitical risk", lowerIsBetter: true },
  { key: "Political_Stability_Score", label: "Political stability", lowerIsBetter: true },
  { key: "Credit_Rating_Score", label: "Credit rating", lowerIsBetter: true },
];

export const PERFORMANCE_METRICS: MetricSpec[] = [
  { key: "Order Change Rate", label: "Order change rate", suffix: "%", lowerIsBetter: true },
  { key: "Order Confirmation Rate", label: "Order confirmation", suffix: "%" },
  { key: "Supplier Delivery Rating", label: "Supplier delivery rating", suffix: "%" },
  { key: "Purchase Order Volume (EUR)", label: "Purchase order volume", suffix: " EUR", lowerIsBetter: true },
];

export const METRIC_CATALOG: MetricSpec[] = [...PERFORMANCE_METRICS, ...RISK_METRICS];

const byKey = new Map(METRIC_CATALOG.map((metric) => [metric.key, metric]));
export function metricSpec(key: string): MetricSpec {
  return byKey.get(key) ?? { key, label: key };
}

// A score of 0 means the signal was not reported for this supplier, so it is shown as N/A and left
// out of every ranking, average and comparison.
export function rawValue(supplier: Supplier, key: string): number | null {
  const raw = supplier[key]?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  return parsed;
}

export function value(supplier: Supplier, key: string): number {
  return rawValue(supplier, key) ?? Number.NaN;
}

export function hasValue(supplier: Supplier, key: string): boolean {
  return rawValue(supplier, key) !== null;
}

export function riskTone(score: number) {
  if (!Number.isFinite(score)) return "bg-black/[0.04] text-black/40 ring-black/10";
  return score >= 75
    ? "bg-red-50 text-red-700 ring-red-200"
    : score >= 50
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : score >= 25
        ? "bg-yellow-50 text-yellow-700 ring-yellow-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

export function riskBarColor(score: number) {
  return score >= 75 ? "bg-red-500" : score >= 50 ? "bg-amber-500" : score >= 25 ? "bg-yellow-500" : "bg-emerald-500";
}

export function formatMoney(raw: string | undefined) {
  const amount = Number(raw);
  return raw?.trim() && Number.isFinite(amount) && amount !== 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount)
    : "N/A";
}

// Cell text for a metric: plain number, percentage, money, or N/A when the score is missing or 0.
export function formatMetric(supplier: Supplier, key: string) {
  const spec = metricSpec(key);
  if (spec.suffix === " EUR") return formatMoney(supplier[key]);
  const current = rawValue(supplier, key);
  if (current === null) return "N/A";
  return `${Number.isInteger(current) ? current : current.toFixed(2)}${spec.suffix ?? ""}`;
}

export function ordinal(position: number) {
  const suffix =
    position % 100 >= 11 && position % 100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[position % 10] ?? "th";
  return `${position}${suffix}`;
}

export function percentileRank(suppliers: Supplier[], supplier: Supplier, key: string) {
  const scored = suppliers.filter((item) => hasValue(item, key)).sort((a, b) => value(a, key) - value(b, key));
  const index = scored.findIndex((item) => item.supplierID === supplier.supplierID);
  if (index < 0 || scored.length === 0) return null;
  return Math.round(((scored.length - index) / scored.length) * 100);
}

export function MetricBar({ label, score, emphasis }: { label: string; score: number; emphasis?: boolean }) {
  if (!Number.isFinite(score)) {
    return (
      <div className="flex items-center justify-between border-b border-black/[0.05] py-2 text-xs">
        <span className="truncate text-black/55">{label}</span>
        <span className="font-mono text-black/35">N/A</span>
      </div>
    );
  }
  return (
    <div className={emphasis ? "rounded-lg bg-red-50 p-2.5 ring-1 ring-red-100" : "py-2"}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-black/65">{label}</span>
        <span className={`font-mono font-semibold ${score >= 75 ? "text-red-700" : score >= 50 ? "text-amber-700" : "text-black/65"}`}>{score}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
        <div className={`h-full rounded-full ${riskBarColor(score)}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

// One metric of one supplier placed against the distribution of every supplier that reports it.
export function MarketMetric({ metric, suppliers, selected, onRemove }: { metric: MetricSpec; suppliers: Supplier[]; selected: Supplier; onRemove?: () => void }) {
  const current = rawValue(selected, metric.key);
  const values = suppliers.map((supplier) => rawValue(supplier, metric.key)).filter((score): score is number => score !== null);
  const suffix = metric.suffix ?? "";

  if (current === null || values.length === 0) {
    return (
      <div className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] text-black/45">{metric.label}</p>
          {onRemove && <RemoveButton onClick={onRemove} label={`Remove ${metric.label}`} />}
        </div>
        <p className="mt-1 text-sm font-semibold">N/A</p>
        <p className="mt-1 text-[11px] text-black/35">Not reported for this supplier</p>
      </div>
    );
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const average = values.reduce((total, score) => total + score, 0) / values.length;
  const rank = Math.round(
    ((metric.lowerIsBetter ? values.filter((score) => score >= current).length : values.filter((score) => score <= current).length) / values.length) * 100,
  );
  const position = maximum === minimum ? 50 : ((current - minimum) / (maximum - minimum)) * 100;
  const averagePosition = maximum === minimum ? 50 : ((average - minimum) / (maximum - minimum)) * 100;
  const favorable = rank >= 50;

  return (
    <div className="rounded-lg border border-black/[0.08] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] text-black/45">{metric.label}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{current.toFixed(2)}{suffix}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${favorable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{ordinal(rank)} percentile</span>
          {onRemove && <RemoveButton onClick={onRemove} label={`Remove ${metric.label}`} />}
        </div>
      </div>
      <div className="mt-3">
        <div className={`relative h-2 rounded-full bg-gradient-to-r ${metric.lowerIsBetter ? "from-emerald-200 via-amber-200 to-red-200" : "from-red-200 via-amber-200 to-emerald-200"}`}>
          <span className="absolute -top-1 h-4 w-0.5 bg-black/35" style={{ left: `${averagePosition}%` }} />
          <span className={`absolute -top-1.5 h-5 w-1.5 -translate-x-1/2 rounded-full border-2 border-white shadow-sm ${favorable ? "bg-emerald-600" : "bg-amber-600"}`} style={{ left: `${position}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-black/35">
          <span>Lower</span>
          <span>Market average {average.toFixed(2)}{suffix}</span>
          <span>Higher</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-black/50">
        {favorable ? `Better than ${rank}% of suppliers` : `Higher exposure than ${100 - rank}% of suppliers`}
        {metric.lowerIsBetter ? " · lower is better" : " · higher is better"}
      </p>
    </div>
  );
}

export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded-md px-1.5 py-0.5 text-xs text-black/30 hover:bg-black/[0.05] hover:text-black/60">
      ✕
    </button>
  );
}
