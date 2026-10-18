"use client";

import { Component, type ReactNode } from "react";

import { isPercent, LEVEL_DOT, type Level } from "./bands";
import { RankCard } from "./RankCard";
import { ScatterCard } from "./ScatterCard";
import { TableCard } from "./TableCard";
import type { Card } from "./types";

const BODY = { rank: RankCard, scatter: ScatterCard, table: TableCard } as const;

/** One comparison card: title, summary, data notes, the chart, and the colour legend. */
export function CardShell({ card, onClose, id }: { card: Card; onClose?: () => void; id?: string }) {
  const Body = BODY[card.renderer];
  // Scatter colours mean quadrant zones (it has its own legend); rank and table colours mean risk bands.
  const banded = card.renderer !== "scatter" && card.metrics.some((m) => levelColoured(card, m));

  return (
    <article
      id={id}
      className="min-w-0 rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">{card.title}</h3>
          <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
            {card.suppliers.length} suppliers · {humanize(card.template)}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Remove card"
            className="rounded-md px-2 py-1 text-sm text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
          >
            ✕
          </button>
        )}
      </header>

      <p className="mt-3 text-sm leading-relaxed">{card.summary}</p>

      {card.dataShape.notes.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-100">
          {card.dataShape.notes.map((note) => (
            <li key={note}>ⓘ {note}</li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <CardErrorBoundary>
          <Body card={card} />
        </CardErrorBoundary>
      </div>

      {banded && (
        <footer className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-black/50 dark:text-white/50">
          {card.referenceBands.map((b) => (
            <span key={b.label} className="inline-flex items-center gap-1">
              <span className={`size-2 rounded-full ${LEVEL_DOT[b.label as Level] ?? "bg-slate-400"}`} />
              {b.label} {b.min}–{b.max}
            </span>
          ))}
        </footer>
      )}
    </article>
  );
}

function levelColoured(card: Card, metric: string) {
  const d = card.valueDirection[metric];
  return d === "categorical" || (d === "lower_is_better" && !isPercent(metric));
}

function humanize(template: string) {
  return template.replace(/_card$/, "").replaceAll("_", " ");
}

class CardErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <p className="text-sm text-black/50 dark:text-white/50">This chart couldn&apos;t be drawn; the summary above still applies.</p>;
    }
    return this.props.children;
  }
}
