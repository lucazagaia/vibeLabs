"use client";

import type { ActivityStep } from "@/lib/research-report";

const KIND_LABEL: Record<ActivityStep["kind"], string> = {
  search: "Search",
  reason: "Reason",
  pivot: "Pivot",
  red_flag: "Red flag",
  plan: "Plan",
  clarify: "Clarify",
  synthesize: "Synthesize",
  follow_up: "Follow-up",
};

export function ActivityFeed({ steps }: { steps: ActivityStep[] }) {
  if (!steps.length) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        Intermediate steps appear here once research starts.
      </p>
    );
  }

  return (
    <ol className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
      {[...steps].reverse().map((step) => (
        <li
          key={step.id}
          className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-black/40 dark:text-white/40">
            <span>
              {KIND_LABEL[step.kind]}
              {step.lane ? ` · ${step.lane}` : ""}
            </span>
            <span
              className={
                step.status === "running"
                  ? "text-teal-600 dark:text-teal-300"
                  : step.status === "skipped"
                    ? "text-black/40 dark:text-white/40"
                    : "text-emerald-600 dark:text-emerald-400"
              }
            >
              {step.status}
            </span>
          </div>
          <p className="mt-1 text-sm">{step.label}</p>
          {step.detail ? (
            <p className="mt-1 whitespace-pre-wrap text-xs text-black/50 dark:text-white/50">
              {step.detail}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
