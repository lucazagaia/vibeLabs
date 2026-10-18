"use client";

import { agentLabel } from "./agents";
import { useDashboard } from "./DashboardContext";
import { SupplierWorkspace } from "./SupplierWorkspace";

// Dashboard skeleton: for now it only shows `show_notice` cards. Real panels (W1–W12) come later.
export function Dashboard() {
  const { notices } = useDashboard();

  return (
    <div className="relative h-full">
      <SupplierWorkspace />
      {notices.length > 0 && <div className="pointer-events-none absolute bottom-4 right-4 z-20 w-72 space-y-2">{notices.map((notice) => <article key={notice.id} className="pointer-events-auto rounded-xl border border-black/10 bg-white/95 p-3 shadow-lg backdrop-blur"><p className="text-[10px] font-medium uppercase tracking-wide text-black/40">Notice · {agentLabel(notice.agentId)}</p><p className="mt-1 text-xs">{notice.text}</p></article>)}</div>}
    </div>
  );
}
