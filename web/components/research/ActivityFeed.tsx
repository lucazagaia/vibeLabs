"use client";

import { useState } from "react";

import type { ActivityStep } from "@/lib/research-report";

const LANE_LABEL: Record<NonNullable<ActivityStep["lane"]>, string> = {
  financial: "Financial",
  esg: "ESG",
  compliance: "Compliance",
  news: "News",
  orchestrator: "Plan",
  red_flag: "Red flag",
};

const STATUS_DOT: Record<ActivityStep["status"], string> = {
  running: "bg-teal-500",
  done: "bg-emerald-500",
  skipped: "bg-black/20 dark:bg-white/25",
};

/** Collapsed to one line by default; expands into dense one-line rows, newest first. */
export function ActivityFeed({ steps }: { steps: ActivityStep[] }) {
  const [open, setOpen] = useState(false);
  const latest = steps.at(-1);

  if (!latest) return null;

  return (
    <div className="rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-xs"
      >
        <span className="shrink-0 font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
          Activity · {steps.length}
        </span>
        <span className="min-w-0 flex-1 truncate text-black/60 dark:text-white/60">
          {latest.label}
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-black/40 transition-transform dark:text-white/40 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open ? (
        <ol className="max-h-56 space-y-0.5 overflow-y-auto border-t border-black/5 px-3 py-2 dark:border-white/10">
          {[...steps].reverse().map((step) => (
            <li
              key={step.id}
              title={step.detail}
              className="flex min-w-0 items-center gap-2 py-0.5 text-xs"
            >
              <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[step.status]}`} />
              <span className="min-w-0 flex-1 truncate">{step.label}</span>
              {step.lane ? (
                <span className="shrink-0 text-black/35 dark:text-white/35">
                  {LANE_LABEL[step.lane]}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
