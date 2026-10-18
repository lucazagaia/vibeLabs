"use client";

import { useCoAgent } from "@copilotkit/react-core";
import {
  EMPTY_RESEARCH_STATE,
  liveStatus,
  type ResearchAgentState,
} from "@/lib/research-report";
import { ActivityFeed } from "./ActivityFeed";
import { ReportPanel } from "./ReportPanel";
import { SourceList } from "./SourceList";
import { StatusLine } from "./StatusLine";

/** Dashboard side of deep research: live status, compact activity, the report, then sources. */
export function ResearchSidePanel() {
  const { state, running } = useCoAgent<ResearchAgentState>({
    name: "research_buddy",
    initialState: EMPTY_RESEARCH_STATE,
  });

  if (!state.company) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-black/50 dark:text-white/50">
        Name a company in the chat to start a risk scan.
      </div>
    );
  }

  const status = running ? liveStatus(state) : null;
  const sources = state.sources ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
            Deep research
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{state.company}</h1>
          {status ? (
            <StatusLine label={status.label} detail={status.detail} />
          ) : state.report ? (
            <StatusLine
              active={false}
              label="Report ready"
              detail={`${sources.length} sources · follow-up searches left: ${state.followUpBudgetRemaining ?? 0}`}
            />
          ) : null}
        </header>

        <ActivityFeed steps={state.activity ?? []} />
        <ReportPanel
          company={state.company}
          report={state.report}
          findings={state.findings ?? []}
        />
        <SourceList sources={sources} collecting={Boolean(status)} />
      </div>
    </div>
  );
}
