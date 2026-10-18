"use client";

import { useEffect, useMemo, useState } from "react";

import { WorkspaceHeader } from "./WorkspaceHeader";
import { pageTitle, type WorkspacePage } from "./WorkspaceSidebar";

type Supplier = Record<string, string> & { supplierID: string; "Supplier Name": string };
type SortKey = "Total_Risk_Index" | "Financial_Health_Score" | "Supplier Delivery Rating" | "Purchase Order Volume (EUR)";
export type SupplierPage = Exclude<WorkspacePage, "home">;

const RISK_METRICS = [
  ["Total_Risk_Index", "Total Risk Index"], ["Industry_Benchmark_Score", "Industry benchmark"], ["Media_Sentiment_Score", "Media sentiment"],
  ["External_Intelligence_Score", "External intelligence"], ["Sub_Tier_Visibility_Score", "Sub-tier visibility"], ["Labor_Stability_Score", "Labor stability"],
  ["Financial_Health_Score", "Financial health"], ["Compliance_Risk_Score", "Compliance risk"], ["Safety_Incident_Score", "Safety incidents"],
  ["Environmental_Exposure_Score", "Environmental exposure"], ["ESG_Performance_Score", "ESG performance"], ["Digital_Security_Score", "Digital security"],
  ["Operational_Resilience_Score", "Operational resilience"], ["Market_Sentiment_Score", "Market sentiment"], ["Quality_Risk_Score", "Quality risk"],
  ["Governance_Risk_Score", "Governance risk"], ["Geopolitical_Risk_Score", "Geopolitical risk"], ["Political_Stability_Score", "Political stability"], ["Credit_Rating_Score", "Credit rating"],
] as const;
const metricLabel = new Map<string, string>(RISK_METRICS);
function rawValue(supplier: Supplier, key: string) {
  const raw = supplier[key]?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
function value(supplier: Supplier, key: string) { return rawValue(supplier, key) ?? Number.NaN; }
function riskTone(score: number) { return score >= 75 ? "bg-red-50 text-red-700 ring-red-200" : score >= 50 ? "bg-amber-50 text-amber-700 ring-amber-200" : score >= 25 ? "bg-yellow-50 text-yellow-700 ring-yellow-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"; }
function formatMoney(raw: string) { const amount = Number(raw); return raw?.trim() && Number.isFinite(amount) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount) : "N/A"; }
function ordinal(value: number) { const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[value % 10] ?? "th"; return `${value}${suffix}`; }
function percentileRank(suppliers: Supplier[], supplier: Supplier, key: string) { const sorted = [...suppliers].sort((a, b) => value(a, key) - value(b, key)); return Math.round(((sorted.length - sorted.findIndex((item) => item.supplierID === supplier.supplierID)) / sorted.length) * 100); }

function MetricBar({ label, score, emphasis }: { label: string; score: number; emphasis?: boolean }) {
  if (!Number.isFinite(score)) return <div className="flex items-center justify-between border-b border-black/[0.05] py-2 text-xs"><span className="truncate text-black/55">{label}</span><span className="font-mono text-black/35">N/A</span></div>;
  return <div className={emphasis ? "rounded-lg bg-red-50 p-2.5 ring-1 ring-red-100" : "py-2"}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate text-black/65">{label}</span><span className={`font-mono font-semibold ${score >= 75 ? "text-red-700" : score >= 50 ? "text-amber-700" : "text-black/65"}`}>{score}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-black/[0.07]"><div className={`h-full rounded-full ${score >= 75 ? "bg-red-500" : score >= 50 ? "bg-amber-500" : score >= 25 ? "bg-yellow-500" : "bg-emerald-500"}`} style={{ width: `${score}%` }} /></div></div>;
}

function MarketMetric({ label, valueKey, suppliers, selected, suffix = "", lowerIsBetter = false }: { label: string; valueKey: string; suppliers: Supplier[]; selected: Supplier; suffix?: string; lowerIsBetter?: boolean }) {
  const current = rawValue(selected, valueKey);
  const values = suppliers.map((supplier) => rawValue(supplier, valueKey)).filter((score): score is number => score !== null);
  if (current === null || values.length === 0) return <div className="rounded-lg border border-black/[0.08] bg-black/[0.02] p-3"><p className="text-[11px] text-black/45">{label}</p><p className="mt-1 text-sm font-semibold">N/A</p><p className="mt-1 text-[11px] text-black/35">No market comparison available</p></div>;
  const minimum = Math.min(...values); const maximum = Math.max(...values); const average = values.reduce((total, score) => total + score, 0) / values.length;
  const rank = Math.round(((lowerIsBetter ? values.filter((score) => score >= current).length : values.filter((score) => score <= current).length) / values.length) * 100);
  const position = maximum === minimum ? 50 : ((current - minimum) / (maximum - minimum)) * 100;
  const averagePosition = maximum === minimum ? 50 : ((average - minimum) / (maximum - minimum)) * 100;
  const favorable = rank >= 50;
  return <div className="rounded-lg border border-black/[0.08] bg-white p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] text-black/45">{label}</p><p className="mt-1 text-lg font-semibold tracking-tight">{current.toFixed(2)}{suffix}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${favorable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{ordinal(rank)} percentile</span></div><div className="mt-3"><div className={`relative h-2 rounded-full bg-gradient-to-r ${lowerIsBetter ? "from-emerald-200 via-amber-200 to-red-200" : "from-red-200 via-amber-200 to-emerald-200"}`}><span className="absolute -top-1 h-4 w-0.5 bg-black/35" style={{ left: `${averagePosition}%` }} /><span className={`absolute -top-1.5 h-5 w-1.5 -translate-x-1/2 rounded-full border-2 border-white shadow-sm ${favorable ? "bg-emerald-600" : "bg-amber-600"}`} style={{ left: `${position}%` }} /></div><div className="mt-1.5 flex justify-between text-[10px] text-black/35"><span>Lower</span><span>Market average {average.toFixed(2)}{suffix}</span><span>Higher</span></div></div><p className="mt-2 text-[11px] text-black/50">{favorable ? `Better than ${rank}% of suppliers` : `Higher exposure than ${100 - rank}% of suppliers`}{lowerIsBetter ? " · lower is better" : " · higher is better"}</p></div>;
}

// The deterministic supplier pages (Suppliers, Favourites, Comparison Pool). The sidebar, the
// active page and the favourites list live in <Dashboard>; this component renders the page body.
export function SupplierWorkspace({
  page,
  active,
  sidebarOpen,
  onToggleSidebar,
  favourites,
  onToggleFavourite,
}: {
  page: SupplierPage;
  active: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  favourites: string[];
  onToggleFavourite: (supplierID: string) => void;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("Total_Risk_Index");
  const [ascending, setAscending] = useState(true);

  // The CSV is only read once a supplier page is actually opened, so Home stays as light as before.
  useEffect(() => {
    if (!active || loaded) return;
    let cancelled = false;
    fetch("/api/suppliers")
      .then((response) => response.json())
      .then((rows: Supplier[]) => {
        if (cancelled) return;
        setSuppliers(rows);
        setLoaded(true);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [active, loaded]);

  const visibleSuppliers = useMemo(() => suppliers
    .filter((supplier) => (page === "favourites" ? favourites.includes(supplier.supplierID) : true))
    .filter((supplier) => !query || `${supplier.supplierID} ${supplier["Supplier Name"]}`.toLowerCase().includes(query.toLowerCase()))
    .filter((supplier) => riskFilter === "All" || supplier.Total_Risk_Index_Level === riskFilter)
    .sort((a, b) => (ascending ? 1 : -1) * (value(a, sortKey) - value(b, sortKey)))
    .slice(0, 250), [ascending, favourites, page, query, riskFilter, sortKey, suppliers]);

  function applySort(nextKey: SortKey) { if (nextKey === sortKey) setAscending((current) => !current); else { setSortKey(nextKey); setAscending(true); } }

  if (selected) {
    const availableMetrics = RISK_METRICS.filter(([key]) => rawValue(selected, key) !== null); const strongest = [...availableMetrics].sort((a, b) => value(selected, a[0]) - value(selected, b[0]))[0]; const weakest = [...availableMetrics].sort((a, b) => value(selected, b[0]) - value(selected, a[0]))[0];
    return <div className="min-w-0 flex-1 overflow-y-auto"><WorkspaceHeader sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar}><button onClick={() => setSelected(null)} className="text-xs font-medium text-black/45 hover:text-black">{pageTitle(page)}</button><span className="text-black/20">/</span><span className="truncate text-sm font-semibold">{selected["Supplier Name"]}</span></WorkspaceHeader><div className="mx-auto max-w-5xl space-y-5 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-black/35">Supplier profile</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{selected["Supplier Name"]}</h1><p className="mt-1 font-mono text-xs text-black/40">{selected.supplierID} · {selected["Supply Chain Complexity"]} supply chain · {selected["Sourcing Risk Level"]} sourcing risk</p></div><button onClick={() => onToggleFavourite(selected.supplierID)} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium shadow-sm hover:bg-black/[0.03]">{favourites.includes(selected.supplierID) ? "★ Favourited" : "☆ Add favourite"}</button></div><div className="grid gap-3 sm:grid-cols-4"><Kpi label="Total risk" value={selected.Total_Risk_Index} tone={riskTone(value(selected, "Total_Risk_Index"))} /><Kpi label="Portfolio rank" value={`#${percentileRank(suppliers, selected, "Total_Risk_Index")}`} /><Kpi label="Delivery rating" value={`${selected["Supplier Delivery Rating"]}%`} /><Kpi label="PO exposure" value={formatMoney(selected["Purchase Order Volume (EUR)"])} /></div><div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">Signals that stand out</h2><p className="mt-1 text-xs text-black/45">Compared with the full supplier dataset.</p></div><span className="rounded-full bg-black/[0.04] px-2 py-1 text-[10px] text-black/45">18 risk signals</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Insight label="Strongest signal" metric={metricLabel.get(strongest[0]) ?? strongest[0]} score={value(selected, strongest[0])} good /><Insight label="Weakest signal" metric={metricLabel.get(weakest[0]) ?? weakest[0]} score={value(selected, weakest[0])} /></div></section><section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-700/70">Mock critical news</p><h2 className="mt-2 text-sm font-semibold text-amber-950">Regional logistics disruption flagged near a supplier facility</h2><p className="mt-2 text-xs leading-5 text-amber-900/70">Trade Press Wire · 3 days ago</p><p className="mt-3 text-xs leading-5 text-amber-900/80">A short-term labor action could affect outbound logistics. Treat this as a demo-only research placeholder until the research agent is connected.</p></section></div><section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold">Risk profile</h2><p className="mt-1 text-xs text-black/45">0 is safest, 100 is highest risk.</p><div className="mt-3 grid gap-x-8 md:grid-cols-2">{RISK_METRICS.map(([key, label]) => <MetricBar key={key} label={label} score={value(selected, key)} emphasis={key === weakest[0]} />)}</div></section><section className="rounded-xl border border-black/10 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Market position</h2><p className="mt-1 text-xs text-black/45">Each marker compares this supplier with all loaded suppliers.</p></div><span className="font-mono text-[10px] text-black/35">● supplier · | average</span></div><div className="mt-4 grid gap-3 lg:grid-cols-2"><MarketMetric label="Order change rate" valueKey="Order Change Rate" suppliers={suppliers} selected={selected} suffix="%" lowerIsBetter /><MarketMetric label="Order confirmation" valueKey="Order Confirmation Rate" suppliers={suppliers} selected={selected} suffix="%" /><MarketMetric label="Supplier delivery rating" valueKey="Supplier Delivery Rating" suppliers={suppliers} selected={selected} suffix="%" /><MarketMetric label="Purchase order volume" valueKey="Purchase Order Volume (EUR)" suppliers={suppliers} selected={selected} suffix=" EUR" lowerIsBetter /></div><div className="mt-3 rounded-lg bg-black/[0.025] px-3 py-2 text-[11px] text-black/45">The percentile describes relative standing in this dataset, not an external market forecast. For change rate and exposure, lower values are treated as better.</div></section></div></div>;
  }

  return <div className="min-w-0 flex-1 overflow-y-auto"><WorkspaceHeader sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar}><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-black/35">Workspace</p><h1 className="text-lg font-semibold tracking-tight">{pageTitle(page)}</h1></div></WorkspaceHeader><div className="mx-auto max-w-6xl space-y-4 p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-black/50">Browse, rank, and inspect supplier risk in one deterministic view.</p><p className="mt-1 text-xs text-black/35">Showing {visibleSuppliers.length} of {suppliers.length || "…"} suppliers</p></div><div className="flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search supplier or ID" className="w-52 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs outline-none ring-black/10 focus:ring-2" /><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"><option>All</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div></div><div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-xs"><thead className="bg-black/[0.025] text-[10px] uppercase tracking-wide text-black/40"><tr><th className="w-10 px-4 py-3">★</th><th className="px-4 py-3">Supplier</th><SortableHeader label="Total risk" active={sortKey === "Total_Risk_Index"} ascending={ascending} onClick={() => applySort("Total_Risk_Index")} /><SortableHeader label="Financial" active={sortKey === "Financial_Health_Score"} ascending={ascending} onClick={() => applySort("Financial_Health_Score")} /><SortableHeader label="Delivery" active={sortKey === "Supplier Delivery Rating"} ascending={ascending} onClick={() => applySort("Supplier Delivery Rating")} /><SortableHeader label="PO exposure" active={sortKey === "Purchase Order Volume (EUR)"} ascending={ascending} onClick={() => applySort("Purchase Order Volume (EUR)")} /><th className="px-4 py-3">Sourcing</th></tr></thead><tbody>{visibleSuppliers.map((supplier) => <tr key={supplier.supplierID} className="border-t border-black/[0.07] hover:bg-black/[0.02]"><td className="px-4 py-3"><button onClick={() => onToggleFavourite(supplier.supplierID)} className={`text-base ${favourites.includes(supplier.supplierID) ? "text-amber-500" : "text-black/20 hover:text-black/45"}`} aria-label="Toggle favourite">★</button></td><td className="px-4 py-3"><button onClick={() => setSelected(supplier)} className="text-left"><span className="block font-medium hover:underline">{supplier["Supplier Name"]}</span><span className="font-mono text-[10px] text-black/35">{supplier.supplierID}</span></button></td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 font-mono text-[11px] ring-1 ${riskTone(value(supplier, "Total_Risk_Index"))}`}>{supplier.Total_Risk_Index}</span></td><td className="px-4 py-3 font-mono text-black/65">{supplier.Financial_Health_Score}</td><td className="px-4 py-3 font-mono text-black/65">{supplier["Supplier Delivery Rating"]}%</td><td className="px-4 py-3 font-mono text-black/65">{formatMoney(supplier["Purchase Order Volume (EUR)"])}</td><td className="px-4 py-3"><span className="rounded-full bg-black/[0.05] px-2 py-1 text-[10px] text-black/60">{supplier["Sourcing Risk Level"]}</span></td></tr>)}</tbody></table></div>{loaded && visibleSuppliers.length === 0 && <p className="px-4 py-6 text-center text-xs text-black/40">{page === "favourites" ? "No favourites yet. Star a supplier to pin it here." : "No suppliers match these filters."}</p>}{!loaded && <p className="px-4 py-6 text-center text-xs text-black/40">Loading suppliers…</p>}</div></div></div>;
}

function SortableHeader({ label, active, ascending, onClick }: { label: string; active: boolean; ascending: boolean; onClick: () => void }) {
  return <th className="px-4 py-3"><button onClick={onClick} className="inline-flex items-center gap-1 hover:text-black">{label}<span className={active ? "text-black" : "text-black/20"}>{active ? (ascending ? "↑" : "↓") : "↕"}</span></button></th>;
}

function Kpi({ label, value: displayValue, tone = "" }: { label: string; value: string; tone?: string }) {
  const valueClass = label === "Total risk" ? "text-lg font-semibold text-black" : `mt-2 text-lg font-semibold ${tone}`;
  return <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm"><p className="text-[10px] uppercase tracking-wide text-black/40">{label}</p><p className={valueClass}>{displayValue}</p></div>;
}

function Insight({ label, metric, score, good }: { label: string; metric: string; score: number; good?: boolean }) {
  return <div className={`border-l-2 py-1 pl-3 ${good ? "border-emerald-500" : "border-red-500"}`}><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-black/40">{label}</p><div className="mt-1 flex items-baseline justify-between gap-3"><p className="text-sm font-semibold text-black/80">{metric}</p><span className={`font-mono text-sm font-semibold ${good ? "text-emerald-700" : "text-red-700"}`}>{score}</span></div><p className="mt-1 text-[11px] text-black/45">{good ? "Lowest observed risk signal" : "Highest observed risk signal"}</p></div>;
}
