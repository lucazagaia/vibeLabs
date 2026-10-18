"use client";

import { useMemo, useState } from "react";

import { CardShell } from "./cards/CardShell";
import { buildLocalCard } from "./cards/localCard";
import { MetricPicker } from "./MetricPicker";
import { usePool } from "./usePool";
import { useSuppliers } from "./useSuppliers";
import { metricSpec, RemoveButton, type Supplier } from "./supplierMetrics";
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
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-black/35 dark:text-white/35">Workspace</p>
          <h1 className="text-lg font-semibold tracking-tight">Comparison Pool</h1>
        </div>
      </WorkspaceHeader>

      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-black/50 dark:text-white/50">Put suppliers side by side and compare them metric by metric.</p>
            <p className="mt-1 text-xs text-black/35 dark:text-white/35">
              {pooled.length} supplier{pooled.length === 1 ? "" : "s"} in the pool · {metrics.length} metric widget{metrics.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <MetricPicker selected={metrics} onToggle={toggleMetric} label="Metrics" />
            {pool.length > 0 && (
              <button
                type="button"
                onClick={clearPool}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black/55 shadow-sm hover:bg-black/[0.03] dark:border-white/10 dark:bg-neutral-900 dark:text-white/55 dark:hover:bg-white/[0.03]"
              >
                Clear pool
              </button>
            )}
          </div>
        </div>

        <section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold">Suppliers in the pool</h2>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">Search to add one, or use “Add to pool” on a supplier profile.</p>

          <div className="relative mt-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={loaded ? "Search supplier or ID to add" : "Loading suppliers…"}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs outline-none ring-black/10 focus:ring-2 dark:border-white/10 dark:bg-neutral-900 dark:ring-white/10"
            />
            {matches.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-neutral-900">
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
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs ${inPool ? "text-black/30 dark:text-white/30" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"}`}
                    >
                      <span className="truncate">
                        {supplier["Supplier Name"]}
                        <span className="ml-2 font-mono text-[10px] text-black/35 dark:text-white/35">{supplier.supplierID}</span>
                      </span>
                      <span className="shrink-0 text-[10px]">{inPool ? "in pool" : "+ add"}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {pooled.length === 0 ? (
            <p className="mt-4 text-xs text-black/40 dark:text-white/40">The pool is empty. Add a supplier to start comparing.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {pooled.map((supplier) => (
                <span key={supplier.supplierID} className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.02] py-1 pl-3 pr-1 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                  <button type="button" onClick={() => onOpenSupplier(supplier)} className="font-medium hover:underline">
                    {supplier["Supplier Name"]}
                  </button>
                  <span className="font-mono text-[10px] text-black/35 dark:text-white/35">{supplier.supplierID}</span>
                  <RemoveButton onClick={() => removeFromPool(supplier.supplierID)} label={`Remove ${supplier["Supplier Name"]} from pool`} />
                </span>
              ))}
            </div>
          )}
        </section>

        {metrics.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-xs text-black/40 dark:border-white/15 dark:text-white/40">
            Tick a metric in the Metrics list to add its widget here.
          </p>
        ) : pooled.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-xs text-black/40 dark:border-white/15 dark:text-white/40">
            Add suppliers to the pool to fill the {metrics.length === 1 ? "widget" : "widgets"}.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {metrics.map((key) => (
              <MetricWidget key={key} metricKey={key} pooled={pooled} onRemove={() => toggleMetric(key)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// One widget per metric, drawn by the same card renderers the agent's dashboard widgets use.
function MetricWidget({ metricKey, pooled, onRemove }: { metricKey: string; pooled: Supplier[]; onRemove: () => void }) {
  const card = useMemo(() => buildLocalCard(metricKey, pooled, `pool-${metricKey}`), [metricKey, pooled]);

  if (!card) {
    return (
      <section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{metricSpec(metricKey).label}</h2>
            <p className="mt-1 text-[11px] text-black/45 dark:text-white/45">No pooled supplier reports this metric.</p>
          </div>
          <RemoveButton onClick={onRemove} label={`Remove ${metricSpec(metricKey).label} widget`} />
        </div>
      </section>
    );
  }

  return <CardShell card={card} mode="full" onClose={onRemove} />;
}
