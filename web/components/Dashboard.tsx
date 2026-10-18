"use client";

import { agentLabel } from "./agents";
import { useDashboard } from "./DashboardContext";

// Dashboard skeleton: for now it only shows `show_notice` cards. Real panels (W1–W12) come later.
export function Dashboard() {
  const { notices } = useDashboard();

  if (notices.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-black/50 dark:text-white/50">
        Ask a Buddy something… results will appear here.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {notices.map((notice) => (
          <article
            key={notice.id}
            className="rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
              Notice · {agentLabel(notice.agentId)}
            </p>
            <p className="mt-1 text-base">{notice.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
