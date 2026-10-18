"use client";

import { FlagBadges } from "./Badges";
import { directionHint, formatValue, LEVEL_DOT, levelOf, makeAxis, type Axis } from "./bands";
import type { Card, CardSupplier } from "./types";

// Light band tints behind 0–100 risk tracks: Low, Medium, High, Critical.
const BAND_TINTS = ["bg-emerald-500/[0.06]", "bg-amber-400/[0.08]", "bg-orange-500/[0.08]", "bg-red-600/[0.08]"];
const LABEL_COL = "grid-cols-[minmax(0,8.5rem)_1fr] @md:grid-cols-[minmax(0,11rem)_1fr]";

/** Sorted lollipops. One metric: one track per supplier. A cluster: a grouped set, one thin track per metric. */
export function RankCard({ card, preview = false }: { card: Card; preview?: boolean }) {
  const metrics = card.metrics.filter((m) => card.valueDirection[m] !== "categorical");
  const grouped = metrics.length > 1;
  const axis = makeAxis(grouped ? "fixed_0_100" : card.dataShape.scale, metrics[0], numbers(card, metrics[0]));
  const exposure = card.valueDirection[metrics[0]] === "higher_means_more_exposure";
  const rows = preview ? card.suppliers.slice(0, grouped ? 3 : 5) : card.suppliers;

  return (
    <div className="@container">
      <p className="mb-2 text-xs text-black/50 dark:text-white/50">
        {grouped
          ? `Each supplier, top to bottom: ${metrics.map((m) => card.metricLabels[m].toLowerCase()).join(" · ")} (${directionHint(card, metrics[0])})`
          : `${card.metricLabels[metrics[0]]}: ${directionHint(card, metrics[0])}`}
        {axis.kind === "log" && " · log scale"}
      </p>
      <ol className={grouped ? "divide-y divide-black/5 dark:divide-white/10" : "space-y-1.5"}>
        {rows.map((s) => (
          <li key={s.supplierID} className={`grid items-center gap-2 ${LABEL_COL} ${grouped ? "py-1.5" : ""}`}>
            <SupplierLabel s={s} exposure={exposure} />
            <div className={grouped ? "space-y-0.5" : ""}>
              {metrics.map((m) => (
                <Track key={m} card={card} s={s} metric={m} axis={axis} thin={grouped} tag={grouped ? shortLabel(card, m) : null} />
              ))}
            </div>
          </li>
        ))}
      </ol>
      {rows.length < card.suppliers.length && (
        <p className="mt-1 text-[11px] text-black/40 dark:text-white/40">+{card.suppliers.length - rows.length} more</p>
      )}
      <div className={`mt-1 grid gap-2 ${LABEL_COL}`}>
        <div />
        <div className={`grid gap-2 ${grouped ? "grid-cols-[4.5rem_1fr_2.75rem]" : "grid-cols-[1fr_3.75rem]"}`}>
          {grouped && <div />}
          <div className="relative h-4 text-[10px] text-black/40 dark:text-white/40">
            {axis.ticks.map((t, i) => (
              <span
                key={t}
                className={`absolute top-0 tabular-nums ${i === 0 ? "" : i === axis.ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
                style={{ left: `${clamp(axis.pos(t)) * 100}%` }}
              >
                {axis.format(t)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SupplierLabel({ s, exposure }: { s: CardSupplier; exposure: boolean }) {
  return (
    <div className="min-w-0" title={s.supplierName}>
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-mono text-xs">{s.supplierID}</span>
        <FlagBadges flags={s.flags} exposure={exposure} />
      </div>
      <div className="truncate text-[11px] text-black/45 dark:text-white/45">{s.supplierName}</div>
    </div>
  );
}

function Track({ card, s, metric, axis, thin, tag }: { card: Card; s: CardSupplier; metric: string; axis: Axis; thin: boolean; tag: string | null }) {
  const v = s.values[metric];
  if (typeof v !== "number") return null;
  const level = levelOf(card, s, metric);
  const p = clamp(axis.pos(v)) * 100;
  const dot = card.valueDirection[metric] === "higher_means_more_exposure" ? "bg-sky-500" : level ? LEVEL_DOT[level] : "bg-slate-500";
  const ring = s.flags.includes("outlier") ? "ring-2 ring-violet-500/70" : s.flags.includes("hidden_watchout") ? "ring-2 ring-amber-500/80" : "";
  const banded = axis.kind === "fixed" && card.valueDirection[metric] === "lower_is_better";

  return (
    <div className={`grid items-center gap-2 ${thin ? "grid-cols-[4.5rem_1fr_2.75rem]" : "grid-cols-[1fr_3.75rem]"}`}>
      {tag && <span className="truncate text-[10px] text-black/45 dark:text-white/45">{tag}</span>}
      <div className={`relative ${thin ? "h-3" : "h-5"}`}>
        {banded && <BandTints />}
        {axis.ticks.map((t) => (
          <div key={t} className="absolute inset-y-0 w-px bg-black/[0.06] dark:bg-white/[0.08]" style={{ left: `${clamp(axis.pos(t)) * 100}%` }} />
        ))}
        <div className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-black/20 dark:bg-white/25" style={{ width: `${p}%` }} />
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${thin ? "size-2" : "size-2.5"} ${dot} ${ring}`}
          style={{ left: `${p}%` }}
          title={`${s.supplierID} · ${card.metricLabels[metric]}: ${formatValue(metric, v)}`}
        />
      </div>
      <div className={`text-right tabular-nums ${thin ? "text-[11px]" : "text-xs"}`}>{formatValue(metric, v)}</div>
    </div>
  );
}

function BandTints() {
  return (
    <div className="absolute inset-0 flex overflow-hidden rounded-sm">
      {BAND_TINTS.map((tint) => (
        <div key={tint} className={`h-full flex-1 ${tint}`} />
      ))}
    </div>
  );
}

function shortLabel(card: Card, metric: string) {
  return card.metricLabels[metric].split(" ")[0];
}

function numbers(card: Card, metric: string) {
  return card.suppliers.map((s) => s.values[metric]).filter((v): v is number => typeof v === "number");
}

function clamp(x: number) {
  return Math.min(1, Math.max(0, x));
}
