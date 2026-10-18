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
      <p className="text-sm text-[var(--muted)]">
        Intermediate steps appear here once research starts.
      </p>
    );
  }

  return (
    <ol className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
      {[...steps].reverse().map((step) => (
        <li
          key={step.id}
          className="rounded-xl border border-[var(--glass-border)] bg-black/15 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-[var(--muted)]">
            <span>
              {KIND_LABEL[step.kind]}
              {step.lane ? ` · ${step.lane}` : ""}
            </span>
            <span
              className={
                step.status === "running"
                  ? "text-[var(--accent)]"
                  : step.status === "skipped"
                    ? "text-[var(--muted)]"
                    : "text-[var(--risk-low)]"
              }
            >
              {step.status}
            </span>
          </div>
          <p className="text-sm mt-1">{step.label}</p>
          {step.detail ? (
            <p className="text-xs text-[var(--muted)] mt-1 whitespace-pre-wrap">
              {step.detail}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
