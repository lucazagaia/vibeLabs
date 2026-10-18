"use client";

import { ChartBody } from "./ChartBody";
import type { Card } from "./types";

const PREVIEW_PANELS = 4;

/** Several topics in one card: a panel (with its own chart) per topic the buyer named. */
export function CompositeCard({ card, preview = false, onOpenPanel }: {
  card: Card;
  preview?: boolean;
  onOpenPanel?: (index: number) => void;
}) {
  const panels = card.panels ?? [];

  if (preview) {
    return (
      <div className="@container">
        <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
          {panels.slice(0, PREVIEW_PANELS).map((p, i) => (
            <div key={`${p.cardId}-${i}`} className="min-w-0 rounded-lg border border-black/10 p-2 dark:border-white/10">
              <p className="truncate text-[11px] font-medium">{p.title}</p>
              <div className="pointer-events-none mt-1 max-h-32 overflow-hidden">
                <ChartBody card={p} preview />
              </div>
            </div>
          ))}
        </div>
        {panels.length > PREVIEW_PANELS && (
          <p className="mt-1 text-[11px] text-black/40 dark:text-white/40">+{panels.length - PREVIEW_PANELS} more panels</p>
        )}
      </div>
    );
  }

  return (
    <div className="@container">
      <div className="grid gap-4 @4xl:grid-cols-2">
        {panels.map((p, i) => (
          <section
            key={`${p.cardId}-${i}`}
            className={`min-w-0 rounded-lg border border-black/10 p-3 dark:border-white/10 ${p.renderer === "table" && p.metrics.length > 6 ? "@4xl:col-span-2" : ""}`}
          >
            <header className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold leading-tight">{p.title}</h4>
              {onOpenPanel && (
                <button
                  type="button"
                  onClick={() => onOpenPanel(i)}
                  className="shrink-0 rounded-md px-2 py-0.5 text-xs text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
                >
                  Expand ↗
                </button>
              )}
            </header>
            <p className="mt-1 text-xs leading-relaxed text-black/60 dark:text-white/60">{p.summary}</p>
            <div className="mt-3">
              <ChartBody card={p} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
