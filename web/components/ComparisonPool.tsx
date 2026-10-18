"use client";

import { useMemo, useState } from "react";

import { MetricPicker } from "./MetricPicker";
import { usePool } from "./usePool";
import { useSuppliers } from "./useSuppliers";
import {
  formatMetric,
  metricSpec,
  rawValue,
  riskBarColor,
  RemoveButton,
  type Supplier,
} from "./supplierMetrics";
import { WorkspaceHeader } from "./WorkspaceHeader";

// Comparison Pool: the buyer collects suppliers here (from a profile page or the search below),
// then ticks metrics to build one widget card per metric.
export function ComparisonPool({
  active,
  sidebarOpen,
  onToggleSidebar,
  onOpenSupplier,
}: {
  active: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenSupplier: (supplier: Supplier) => void;
}) {
  const { suppliers, loaded } = useSuppliers(active);
  const { pool, addToPool, removeFromPool, clearPool } = usePool();
  const [query, setQuery] = useState("");
  const [metrics, setMetrics] = useState<string[]>(["Total_Risk_Index"]);

  const pooled = useMemo(
    () => pool.map((id) => suppliers.find((supplier) => supplier.supplierID === id)).filter((supplier): supplier is Supplier => Boolean(supplier)),
    [pool, suppliers],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return suppliers
      .filter((supplier) => `${supplier.supplierID} ${supplier["Supplier Name"]}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [query, suppliers]);

  function toggleMetric(key: string) {
    setMetrics((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <WorkspaceHeader sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar}>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-black/35">Workspace</p>
          <h1 className="text-lg font-semibold tracking-tight">Comparison Pool</h1>
        </div>
      </WorkspaceHeader>

      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-black/50">Put suppliers side by side and compare them metric by metric.</p>
            <p className="mt-1 text-xs text-black/35">
              {pooled.length} supplier{pooled.length === 1 ? "" : "s"} in the pool · {metrics.length} metric widget{metrics.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <MetricPicker selected={metrics} onToggle={toggleMetric} label="Metrics" />
            {pool.length > 0 && (
              <button
                type="button"
                onClick={clearPool}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black/55 shadow-sm hover:bg-black/[0.03]"
              >
                Clear pool
              </button>
            )}
          </div>
        </div>

        <section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Suppliers in the pool</h2>
          <p className="mt-1 text-xs text-black/45">Search to add one, or use “Add to pool” on a supplier profile.</p>

          <div className="relative mt-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={loaded ? "Search supplier or ID to add" : "Loading suppliers…"}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs outline-none ring-black/10 focus:ring-2"
            />
            {matches.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg">
                {matches.map((supplier) => {
                  const inPool = pool.includes(supplier.supplierID);
                  return (
                    <button
                      key={supplier.supplierID}
                      type="button"
                      disabled={inPool}
                      onClick={() => {
                        addToPool(supplier.supplierID);
                        setQuery("");
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs ${inPool ? "text-black/30" : "hover:bg-black/[0.04]"}`}
                    >
                      <span className="truncate">
                        {supplier["Supplier Name"]}
                        <span className="ml-2 font-mono text-[10px] text-black/35">{supplier.supplierID}</span>
                      </span>
                      <span className="shrink-0 text-[10px]">{inPool ? "in pool" : "+ add"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {pooled.length === 0 ? (
            <p className="mt-4 text-xs text-black/40">The pool is empty. Add a supplier to start comparing.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {pooled.map((supplier) => (
                <span key={supplier.supplierID} className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.02] py-1 pl-3 pr-1 text-xs">
                  <button type="button" onClick={() => onOpenSupplier(supplier)} className="font-medium hover:underline">
                    {supplier["Supplier Name"]}
                  </button>
                  <span className="font-mono text-[10px] text-black/35">{supplier.supplierID}</span>
                  <RemoveButton onClick={() => removeFromPool(supplier.supplierID)} label={`Remove ${supplier["Supplier Name"]} from pool`} />
                </span>
              ))}
            </div>
          )}
        </section>

        {metrics.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-xs text-black/40">
            Tick a metric in the Metrics list to add its widget here.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {metrics.map((key) => (
              <MetricWidget key={key} metricKey={key} pooled={pooled} suppliers={suppliers} onRemove={() => toggleMetric(key)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// One widget card: every pooled supplier on a single metric, against the market average.
function MetricWidget({
  metricKey,
  pooled,
  suppliers,
  onRemove,
}: {
  metricKey: string;
  pooled: Supplier[];
  suppliers: Supplier[];
  onRemove: () => void;
}) {
  const spec = metricSpec(metricKey);
  const scored = pooled
    .map((supplier) => ({ supplier, score: rawValue(supplier, metricKey) }))
    .filter((row): row is { supplier: Supplier; score: number } => row.score !== null);
  const marketValues = suppliers.map((supplier) => rawValue(supplier, metricKey)).filter((score): score is number => score !== null);
  const marketAverage = marketValues.length ? marketValues.reduce((total, score) => total + score, 0) / marketValues.length : null;
  const best = scored.length
    ? scored.reduce((winner, row) => ((spec.lowerIsBetter ? row.score < winner.score : row.score > winner.score) ? row : winner))
    : null;
  const scale = Math.max(...scored.map((row) => row.score), marketAverage ?? 0, 1);

  return (
    <section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{spec.label}</h2>
          <p className="mt-1 text-[11px] text-black/45">
            {spec.lowerIsBetter ? "Lower is better" : "Higher is better"}
            {marketAverage !== null && ` · market average ${marketAverage.toFixed(2)}${spec.suffix ?? ""}`}
          </p>
        </div>
        <RemoveButton onClick={onRemove} label={`Remove ${spec.label} widget`} />
      </div>

      {pooled.length === 0 ? (
        <p className="mt-4 text-xs text-black/40">Add suppliers to the pool to fill this widget.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {pooled.map((supplier) => {
            const score = rawValue(supplier, metricKey);
            const isBest = best?.supplier.supplierID === supplier.supplierID;
            return (
              <div key={supplier.supplierID}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate text-black/65">
                    {supplier["Supplier Name"]}
                    {isBest && <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">best</span>}
                  </span>
                  <span className={`font-mono font-semibold ${score === null ? "text-black/35" : "text-black/70"}`}>{formatMetric(supplier, metricKey)}</span>
                </div>
                <div className="relative mt-1.5 h-1.5 rounded-full bg-black/[0.07]">
                  {score !== null && (
                    <div
                      className={`h-full rounded-full ${spec.lowerIsBetter ? riskBarColor((score / scale) * 100) : "bg-sky-500"}`}
                      style={{ width: `${Math.max((score / scale) * 100, 2)}%` }}
                    />
                  )}
                  {marketAverage !== null && (
                    <span className="absolute -top-1 h-3.5 w-0.5 bg-black/35" style={{ left: `${Math.min((marketAverage / scale) * 100, 100)}%` }} />
                  )}
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-[10px] text-black/35">| market average across suppliers that report this metric</p>
        </div>
      )}
    </section>
  );
}
