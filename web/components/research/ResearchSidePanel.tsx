"use client";

import { useCoAgent } from "@copilotkit/react-core";
import {
  EMPTY_RESEARCH_STATE,
  type ResearchAgentState,
} from "@/lib/research-report";
import { ActivityFeed } from "./ActivityFeed";
import { ReportPanel } from "./ReportPanel";
import { SourceList } from "./SourceList";

/** Dashboard-side progress theme for deep research (activity, sources, report). */
export function ResearchSidePanel() {
  const { state } = useCoAgent<ResearchAgentState>({
    name: "research_buddy",
    initialState: EMPTY_RESEARCH_STATE,
  });

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
          Deep research
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {state.company || "Name a company in chat"}
        </h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Phase: {state.phase || "idle"}
          {state.followUpBudgetRemaining != null
            ? ` · follow-up searches left: ${state.followUpBudgetRemaining}`
            : ""}
        </p>
      </header>

      <div className="space-y-4">
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-black/40 dark:text-white/40">
            Activity
          </h2>
          <ActivityFeed steps={state.activity ?? []} />
        </section>
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-black/40 dark:text-white/40">
            Sources
          </h2>
          <SourceList sources={state.sources ?? []} />
        </section>
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <ReportPanel company={state.company ?? ""} report={state.report} />
        </section>
      </div>
    </div>
  );
}
