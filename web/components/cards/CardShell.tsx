"use client";

import { Component, type ReactNode } from "react";

import { isPercent, LEVEL_DOT, type Level } from "./bands";
import { ChartBody } from "./ChartBody";
import { CompositeCard } from "./CompositeCard";
import type { Card } from "./types";

type Props = {
  card: Card;
  /** "preview": compact dashboard widget, click to open. "full": the whole card (maximized view, /cards). */
  mode?: "preview" | "full";
  onOpen?: () => void;
  onOpenPanel?: (index: number) => void;
  onClose?: () => void;
  id?: string;
};

/** One comparison card: title, summary, data notes, the chart (or a composite's panels), and the colour legend. */
export function CardShell({ card, mode = "full", onOpen, onOpenPanel, onClose, id }: Props) {
  const preview = mode === "preview";
  const composite = card.renderer === "composite";
  // Scatter colours mean quadrant zones (it has its own legend); rank and table colours mean risk bands.
  const banded = !preview && !composite && card.renderer !== "scatter" && card.metrics.some((m) => levelColoured(card, m));
  const meta = composite
    ? `${card.panels?.length ?? 0} panels · ${card.suppliers.length} suppliers`
    : `${card.suppliers.length} suppliers · ${humanize(card.template)}`;

  return (
    <article
      id={id}
      onClick={preview ? onOpen : undefined}
      onKeyDown={preview && onOpen ? (e) => (e.key === "Enter" || e.key === " ") && onOpen() : undefined}
      role={preview && onOpen ? "button" : undefined}
      tabIndex={preview && onOpen ? 0 : undefined}
      className={`min-w-0 rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900 ${
        preview && onOpen ? "cursor-pointer transition hover:border-sky-500/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-sky-500" : ""
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`font-semibold leading-tight ${preview ? "truncate text-sm" : "text-base"}`}>{card.title}</h3>
          <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">{meta}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {preview && onOpen && <span className="text-xs text-sky-700 dark:text-sky-300">Open ↗</span>}
          {onClose && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Remove card"
              className="rounded-md px-2 py-1 text-sm text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      <p className={`mt-2 text-sm leading-relaxed ${preview ? "line-clamp-2 text-black/70 dark:text-white/70" : ""}`}>{card.summary}</p>

      {!preview && card.dataShape.notes.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-100">
          {card.dataShape.notes.map((note) => (
            <li key={note}>ⓘ {note}</li>
          ))}
        </ul>
      )}

      <div className={`mt-3 ${preview ? "pointer-events-none max-h-56 overflow-hidden" : "mt-4"}`}>
        <CardErrorBoundary>
          {composite ? (
            <CompositeCard card={card} preview={preview} onOpenPanel={onOpenPanel} />
          ) : (
            <ChartBody card={card} preview={preview} />
          )}
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
