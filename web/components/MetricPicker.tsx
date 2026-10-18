"use client";

import { METRIC_CATALOG, type MetricSpec } from "./supplierMetrics";

// Tick a metric and its widget appears on the page; untick it and the widget goes away.
export function MetricPicker({
  selected,
  onToggle,
  metrics = METRIC_CATALOG,
  label = "Add metric",
  alwaysOn = [],
}: {
  selected: string[];
  onToggle: (key: string) => void;
  metrics?: MetricSpec[];
  label?: string;
  alwaysOn?: string[];
}) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-black/65 shadow-sm hover:bg-black/[0.03]">
        {label}
        {selected.length > 0 && <span className="rounded-full bg-black/[0.08] px-1.5 py-0.5 text-[10px]">{selected.length}</span>}
        <span className="text-black/30">▾</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl border border-black/10 bg-white p-2 shadow-lg">
        {metrics.map((metric) => {
          const fixed = alwaysOn.includes(metric.key);
          const checked = fixed || selected.includes(metric.key);
          return (
            <label
              key={metric.key}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${fixed ? "text-black/35" : "cursor-pointer text-black/70 hover:bg-black/[0.04]"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={fixed}
                onChange={() => onToggle(metric.key)}
                className="h-3.5 w-3.5 accent-black"
              />
              <span className="truncate">{metric.label}</span>
              {fixed && <span className="ml-auto text-[10px]">always shown</span>}
            </label>
          );
        })}
      </div>
    </details>
  );
}
