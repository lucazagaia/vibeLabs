"use client";

import { useMemo, useState } from "react";

import { MetricPicker } from "./MetricPicker";
import { activeFilterCount, EMPTY_FILTERS, SupplierFilters, type SupplierFilterState } from "./SupplierFilters";
import { usePool } from "./usePool";
import { useSuppliers } from "./useSuppliers";
import {
  formatMetric,
  formatMoney,
  hasValue,
  MarketMetric,
  MetricBar,
  METRIC_CATALOG,
  metricSpec,
  percentileRank,
  rawValue,
  PERFORMANCE_METRICS,
  riskTone,
  RISK_METRICS,
  value,
  type Supplier,
} from "./supplierMetrics";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { pageTitle, type WorkspacePage } from "./WorkspaceSidebar";

type SortKey = "Total_Risk_Index" | "Financial_Health_Score" | "Supplier Delivery Rating" | "Purchase Order Volume (EUR)";
export type SupplierPage = Extract<WorkspacePage, "suppliers" | "favourites">;

const DEFAULT_MARKET_KEYS = PERFORMANCE_METRICS.map((metric) => metric.key);
const ROW_LIMIT = 250;

function toNumber(raw: string) {
  const parsed = Number(raw);
  return raw.trim() && Number.isFinite(parsed) ? parsed : null;
}

function withinFloor(score: number | null, floor: number | null) {
  return floor === null || (score !== null && score >= floor);
}

function withinCeiling(score: number | null, ceiling: number | null) {
  return ceiling === null || (score !== null && score <= ceiling);
}

// The Suppliers and Favourites pages, plus the supplier profile they open. The sidebar, the active
// page, the selected supplier and the saved lists live in <Dashboard>.
export function SupplierWorkspace({
  page,
  active,
  sidebarOpen,
  onToggleSidebar,
  favourites,
  onToggleFavourite,
  selected,
  onSelect,
}: {
  page: SupplierPage;
  active: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  favourites: string[];
  onToggleFavourite: (supplierID: string) => void;
  selected: Supplier | null;
  onSelect: (supplier: Supplier | null) => void;
}) {
  const { suppliers, loaded } = useSuppliers(active);
  const { pool, togglePooled } = usePool();
  const [filters, setFilters] = useState<SupplierFilterState>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("Total_Risk_Index");
  const [ascending, setAscending] = useState(true);
  const [extraMarketKeys, setExtraMarketKeys] = useState<string[]>([]);

  const matching = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();
    const minRisk = toNumber(filters.minRisk);
    const maxRisk = toNumber(filters.maxRisk);
    const minDelivery = toNumber(filters.minDelivery);
    const minVolume = toNumber(filters.minVolume);

    return suppliers
      .filter((supplier) => {
        if (page === "favourites" && !favourites.includes(supplier.supplierID)) return false;
        if (filters.onlyFavourites && !favourites.includes(supplier.supplierID)) return false;
        if (filters.onlyPool && !pool.includes(supplier.supplierID)) return false;
        if (needle && !`${supplier.supplierID} ${supplier["Supplier Name"]}`.toLowerCase().includes(needle)) return false;
        if (filters.riskLevels.length && !filters.riskLevels.includes(supplier.Total_Risk_Index_Level)) return false;
        if (filters.sourcing.length && !filters.sourcing.includes(supplier["Sourcing Risk Level"])) return false;
        if (filters.complexity.length && !filters.complexity.includes(supplier["Supply Chain Complexity"])) return false;
        // A metric that is not reported cannot clear a threshold, so those suppliers drop out.
        return (
          withinFloor(rawValue(supplier, "Total_Risk_Index"), minRisk) &&
          withinCeiling(rawValue(supplier, "Total_Risk_Index"), maxRisk) &&
          withinFloor(rawValue(supplier, "Supplier Delivery Rating"), minDelivery) &&
          withinFloor(rawValue(supplier, "Purchase Order Volume (EUR)"), minVolume)
        );
      })
      .sort((a, b) => (ascending ? 1 : -1) * (value(a, sortKey) - value(b, sortKey)));
  }, [ascending, favourites, filters, page, pool, sortKey, suppliers]);

  const visibleSuppliers = useMemo(() => matching.slice(0, ROW_LIMIT), [matching]);

  const filterCount = activeFilterCount(filters);

  function applySort(nextKey: SortKey) {
    if (nextKey === sortKey) setAscending((current) => !current);
    else { setSortKey(nextKey); setAscending(true); }
  }

  function toggleMarketKey(key: string) {
    setExtraMarketKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  if (selected) {
    // Signals with no score (missing or 0) are left out of the strongest/weakest comparison.
    const reported = RISK_METRICS.filter((metric) => hasValue(selected, metric.key));
    const ranked = [...reported].sort((a, b) => value(selected, a.key) - value(selected, b.key));
    const strongest = ranked[0] ?? null;
    const weakest = ranked[ranked.length - 1] ?? null;
    const rank = percentileRank(suppliers, selected, "Total_Risk_Index");
    const inPool = pool.includes(selected.supplierID);
    const marketKeys = [...DEFAULT_MARKET_KEYS, ...extraMarketKeys.filter((key) => !DEFAULT_MARKET_KEYS.includes(key))];

    return (
      <div className="min-w-0 flex-1 overflow-y-auto">
        <WorkspaceHeader sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar}>
          <button onClick={() => onSelect(null)} className="text-xs font-medium text-black/45 hover:text-black">{pageTitle(page)}</button>
          <span className="text-black/20">/</span>
          <span className="truncate text-sm font-semibold">{selected["Supplier Name"]}</span>
        </WorkspaceHeader>

        <div className="mx-auto max-w-5xl space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-black/35">Supplier profile</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{selected["Supplier Name"]}</h1>
              <p className="mt-1 font-mono text-xs text-black/40">{selected.supplierID} · {selected["Supply Chain Complexity"]} supply chain · {selected["Sourcing Risk Level"]} sourcing risk</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => togglePooled(selected.supplierID)} className={`rounded-lg border px-3 py-2 text-xs font-medium shadow-sm ${inPool ? "border-black/15 bg-black/[0.06] text-black" : "border-black/10 bg-white hover:bg-black/[0.03]"}`}>
                {inPool ? "◫ In comparison pool" : "◫ Add to pool"}
              </button>
              <button onClick={() => onToggleFavourite(selected.supplierID)} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium shadow-sm hover:bg-black/[0.03]">
                {favourites.includes(selected.supplierID) ? "★ Favourited" : "☆ Add favourite"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi label="Total risk" value={formatMetric(selected, "Total_Risk_Index")} tone={riskTone(value(selected, "Total_Risk_Index"))} />
            <Kpi label="Portfolio rank" value={rank === null ? "N/A" : `#${rank}`} />
            <Kpi label="Delivery rating" value={formatMetric(selected, "Supplier Delivery Rating")} />
            <Kpi label="PO exposure" value={formatMoney(selected["Purchase Order Volume (EUR)"])} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Signals that stand out</h2>
                  <p className="mt-1 text-xs text-black/45">Compared with the full supplier dataset.</p>
                </div>
                <span className="rounded-full bg-black/[0.04] px-2 py-1 text-[10px] text-black/45">{reported.length} reported signals</span>
              </div>
              {strongest && weakest ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Insight label="Strongest signal" metric={strongest.label} score={value(selected, strongest.key)} good />
                  <Insight label="Weakest signal" metric={weakest.label} score={value(selected, weakest.key)} />
                </div>
              ) : (
                <p className="mt-4 text-xs text-black/40">No risk signals are reported for this supplier.</p>
              )}
            </section>

            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-700/70">Mock critical news</p>
              <h2 className="mt-2 text-sm font-semibold text-amber-950">Regional logistics disruption flagged near a supplier facility</h2>
              <p className="mt-2 text-xs leading-5 text-amber-900/70">Trade Press Wire · 3 days ago</p>
              <p className="mt-3 text-xs leading-5 text-amber-900/80">A short-term labor action could affect outbound logistics. Treat this as a demo-only research placeholder until the research agent is connected.</p>
            </section>
          </div>

          <section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Risk profile</h2>
            <p className="mt-1 text-xs text-black/45">0 is safest, 100 is highest risk. Unreported signals show as N/A.</p>
            <div className="mt-3 grid gap-x-8 md:grid-cols-2">
              {RISK_METRICS.map((metric) => (
                <MetricBar key={metric.key} label={metric.label} score={value(selected, metric.key)} emphasis={metric.key === weakest?.key} />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Market position</h2>
                <p className="mt-1 text-xs text-black/45">Each marker compares this supplier with every supplier that reports the metric.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-black/35">● supplier · | average</span>
                <MetricPicker selected={extraMarketKeys} onToggle={toggleMarketKey} metrics={METRIC_CATALOG} alwaysOn={DEFAULT_MARKET_KEYS} />
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {marketKeys.map((key) => (
                <MarketMetric
                  key={key}
                  metric={metricSpec(key)}
                  suppliers={suppliers}
                  selected={selected}
                  onRemove={DEFAULT_MARKET_KEYS.includes(key) ? undefined : () => toggleMarketKey(key)}
                />
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-black/[0.025] px-3 py-2 text-[11px] text-black/45">The percentile describes relative standing in this dataset, not an external market forecast. For change rate and exposure, lower values are treated as better.</div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <WorkspaceHeader sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar}>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-black/35">Workspace</p>
          <h1 className="text-lg font-semibold tracking-tight">{pageTitle(page)}</h1>
        </div>
      </WorkspaceHeader>

      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div>
          <p className="text-sm text-black/50">Browse, rank, and inspect supplier risk in one deterministic view.</p>
          <p className="mt-1 text-xs text-black/35">
            Showing {visibleSuppliers.length} of {matching.length} {filterCount > 0 ? "matching " : ""}supplier{matching.length === 1 ? "" : "s"}
            {suppliers.length > 0 && ` · ${suppliers.length} in the dataset`}
            {matching.length > ROW_LIMIT && ` · first ${ROW_LIMIT} shown, narrow the filters to see the rest`}
          </p>
        </div>

        <SupplierFilters filters={filters} onChange={setFilters} showFavouriteToggle={page !== "favourites"} />

        <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="bg-black/[0.025] text-[10px] uppercase tracking-wide text-black/40">
                <tr>
                  <th className="w-10 px-4 py-3">★</th>
                  <th className="w-10 px-4 py-3">◫</th>
                  <th className="px-4 py-3">Supplier</th>
                  <SortableHeader label="Total risk" active={sortKey === "Total_Risk_Index"} ascending={ascending} onClick={() => applySort("Total_Risk_Index")} />
                  <SortableHeader label="Financial" active={sortKey === "Financial_Health_Score"} ascending={ascending} onClick={() => applySort("Financial_Health_Score")} />
                  <SortableHeader label="Delivery" active={sortKey === "Supplier Delivery Rating"} ascending={ascending} onClick={() => applySort("Supplier Delivery Rating")} />
                  <SortableHeader label="PO exposure" active={sortKey === "Purchase Order Volume (EUR)"} ascending={ascending} onClick={() => applySort("Purchase Order Volume (EUR)")} />
                  <th className="px-4 py-3">Sourcing</th>
                </tr>
              </thead>
              <tbody>
                {visibleSuppliers.map((supplier) => (
                  <tr key={supplier.supplierID} className="border-t border-black/[0.07] hover:bg-black/[0.02]">
                    <td className="px-4 py-3">
                      <button onClick={() => onToggleFavourite(supplier.supplierID)} className={`text-base ${favourites.includes(supplier.supplierID) ? "text-amber-500" : "text-black/20 hover:text-black/45"}`} aria-label="Toggle favourite">★</button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => togglePooled(supplier.supplierID)} className={`text-sm ${pool.includes(supplier.supplierID) ? "text-black" : "text-black/20 hover:text-black/45"}`} aria-label="Toggle comparison pool">◫</button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => onSelect(supplier)} className="text-left">
                        <span className="block font-medium hover:underline">{supplier["Supplier Name"]}</span>
                        <span className="font-mono text-[10px] text-black/35">{supplier.supplierID}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-md px-2 py-1 font-mono text-[11px] ring-1 ${riskTone(value(supplier, "Total_Risk_Index"))}`}>{formatMetric(supplier, "Total_Risk_Index")}</span></td>
                    <td className="px-4 py-3 font-mono text-black/65">{formatMetric(supplier, "Financial_Health_Score")}</td>
                    <td className="px-4 py-3 font-mono text-black/65">{formatMetric(supplier, "Supplier Delivery Rating")}</td>
                    <td className="px-4 py-3 font-mono text-black/65">{formatMoney(supplier["Purchase Order Volume (EUR)"])}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-black/[0.05] px-2 py-1 text-[10px] text-black/60">{supplier["Sourcing Risk Level"]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loaded && visibleSuppliers.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-black/40">
              {page === "favourites" && favourites.length === 0
                ? "No favourites yet. Star a supplier to pin it here."
                : "No suppliers match these filters."}
            </p>
          )}
          {!loaded && <p className="px-4 py-6 text-center text-xs text-black/40">Loading suppliers…</p>}
        </div>
      </div>
    </div>
  );
}

function SortableHeader({ label, active, ascending, onClick }: { label: string; active: boolean; ascending: boolean; onClick: () => void }) {
  return (
    <th className="px-4 py-3">
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-black">
        {label}
        <span className={active ? "text-black" : "text-black/20"}>{active ? (ascending ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function Kpi({ label, value: displayValue, tone = "" }: { label: string; value: string; tone?: string }) {
  const valueClass = label === "Total risk" ? "text-lg font-semibold text-black" : `mt-2 text-lg font-semibold ${tone}`;
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <p className="text-[10px] uppercase tracking-wide text-black/40">{label}</p>
      <p className={valueClass}>{displayValue}</p>
    </div>
  );
}

function Insight({ label, metric, score, good }: { label: string; metric: string; score: number; good?: boolean }) {
  return (
    <div className={`border-l-2 py-1 pl-3 ${good ? "border-emerald-500" : "border-red-500"}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-black/40">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-black/80">{metric}</p>
        <span className={`font-mono text-sm font-semibold ${good ? "text-emerald-700" : "text-red-700"}`}>{score}</span>
      </div>
      <p className="mt-1 text-[11px] text-black/45">{good ? "Lowest reported risk signal" : "Highest reported risk signal"}</p>
    </div>
  );
}
