"use client";

import { agentLabel } from "./agents";
import { useDashboard } from "./DashboardContext";

// Home is the original dashboard: it only shows `show_notice` cards from the agents.
// Real panels (W1–W12) come later. The deterministic supplier pages live beside it in the sidebar.
export function HomeView() {
  const { notices } = useDashboard();

  if (notices.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-black/50">
        Ask a Buddy something… results will appear here.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {notices.map((notice) => (
          <article key={notice.id} className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-black/40">
              Notice · {agentLabel(notice.agentId)}
            </p>
            <p className="mt-1 text-base">{notice.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
