"use client";

import { FlagBadges } from "./Badges";
import { formatValue, LEVEL_CELL, levelOf, type Level } from "./bands";
import type { Card } from "./types";

/** Suppliers × metrics with colour-banded cells; the replaceability card is a 3×3 grid instead. */
export function TableCard({ card }: { card: Card }) {
  if (card.template === "replaceability_complexity_card" && card.facts.grid) return <ReplaceabilityGrid card={card} />;

  const watch = new Set((card.facts.hiddenWatchouts ?? []).map((h) => `${h.supplierID}|${h.metric}`));
  const recommended = card.facts.recommended as string | undefined;

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <table className={`border-separate border-spacing-0 text-xs ${card.metrics.length > 3 ? "w-full" : "w-auto"}`}>
        <thead>
          <tr className="align-bottom">
            <th className="sticky left-0 z-10 bg-white pr-3 pb-2 text-left font-medium text-black/50 dark:bg-neutral-900 dark:text-white/50">
              Supplier
            </th>
            {card.metrics.map((m) => (
              <th key={m} className="min-w-[4.25rem] px-1 pb-2 text-center text-[11px] leading-tight font-medium text-black/60 dark:text-white/60">
                {card.metricLabels[m]}
                {m === card.sort.field && <span className="ml-0.5 text-black/35 dark:text-white/35">{card.sort.direction === "asc" ? "↑" : "↓"}</span>}
                {card.valueDirection[m] !== "lower_is_better" && card.valueDirection[m] !== "categorical" && (
                  <div className="font-normal text-black/35 dark:text-white/35">
                    {card.valueDirection[m] === "higher_is_better" ? "higher better" : "exposure"}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {card.suppliers.map((s) => {
            const accent = s.flags.includes("hidden_watchout")
              ? "border-l-amber-500"
              : s.supplierID === recommended
                ? "border-l-emerald-600"
                : "border-l-transparent";
            return (
              <tr key={s.supplierID}>
                <td className={`sticky left-0 z-10 border-l-2 bg-white py-1 pr-3 pl-2 dark:bg-neutral-900 ${accent}`}>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-mono">{s.supplierID}</span>
                    <FlagBadges flags={s.flags} />
                  </div>
                  <div className="max-w-[11rem] truncate text-[11px] text-black/45 dark:text-white/45" title={s.supplierName}>
                    {s.supplierName}
                  </div>
                </td>
                {card.metrics.map((m) => {
                  const level = levelOf(card, s, m);
                  const flagged = watch.has(`${s.supplierID}|${m}`);
                  return (
                    <td key={m} className="p-0.5">
                      <div
                        className={`rounded px-1.5 py-1 text-center tabular-nums ${level ? LEVEL_CELL[level] : "bg-black/[0.03] dark:bg-white/[0.05]"} ${flagged ? "font-semibold ring-2 ring-amber-500 ring-inset" : ""}`}
                        title={`${s.supplierID} · ${card.metricLabels[m]}: ${formatValue(m, s.values[m])}${level ? ` (${level})` : ""}`}
                      >
                        {formatValue(m, s.values[m])}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const SOURCING = ["High", "Medium", "Low"] as const; // hard to replace at the top
const COMPLEXITY = ["Simple", "Moderate", "Complex"] as const;
const GRID_LEVEL: Level[] = ["Low", "Low", "Medium", "High", "Critical"];

function ReplaceabilityGrid({ card }: { card: Card }) {
  const grid = card.facts.grid as Record<string, string[]>;
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2">
      <div className="flex items-center">
        <span className="text-[11px] text-black/50 [writing-mode:vertical-rl] rotate-180 dark:text-white/50">Harder to replace →</span>
      </div>
      <div>
        <div className="grid grid-cols-[3.5rem_repeat(3,minmax(0,1fr))] gap-1">
          {SOURCING.map((src, row) => (
            <Row key={src} label={src}>
              {COMPLEXITY.map((cx, col) => {
                const ids = grid[`${src} x ${cx}`] ?? [];
                const level = GRID_LEVEL[2 - row + col];
                return (
                  <div key={cx} className={`min-h-16 rounded-md p-1.5 ${LEVEL_CELL[level]}`}>
                    <div className="text-[10px] opacity-70">{ids.length} supplier{ids.length === 1 ? "" : "s"}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ids.map((id) => (
                        <span key={id} className="rounded bg-white/70 px-1 font-mono text-[10px] text-black/80 dark:bg-black/30 dark:text-white/85">
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Row>
          ))}
          <div />
          {COMPLEXITY.map((cx) => (
            <div key={cx} className="text-center text-[11px] text-black/60 dark:text-white/60">{cx}</div>
          ))}
        </div>
        <p className="mt-1 text-center text-[11px] text-black/50 dark:text-white/50">Supply chain complexity →</p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center text-[11px] text-black/60 dark:text-white/60">{label}</div>
      {children}
    </>
  );
}
