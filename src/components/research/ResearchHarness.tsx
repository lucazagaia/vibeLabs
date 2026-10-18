"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CopilotKit,
  useCoAgent,
  useCoAgentStateRender,
  useLangGraphInterrupt,
} from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import {
  EMPTY_RESEARCH_STATE,
  type ClarifierOption,
  type ResearchAgentState,
} from "@/lib/research-report";
import { ActivityFeed } from "./ActivityFeed";
import { ReportPanel } from "./ReportPanel";
import { SourceList } from "./SourceList";

type ClarifierInterrupt = {
  type?: string;
  questionId?: string;
  question?: string;
  options?: ClarifierOption[];
};

function ResearchWorkspace() {
  const router = useRouter();
  const { state } = useCoAgent<ResearchAgentState>({
    name: "research_agent",
    initialState: EMPTY_RESEARCH_STATE,
  });

  useCoAgentStateRender<ResearchAgentState>({
    name: "research_agent",
    render: ({ state: live }) => {
      const latest = live?.activity?.slice(-3) ?? [];
      if (!latest.length) return null;
      return (
        <div className="rounded-xl border border-[var(--glass-border)] bg-black/30 p-3 my-2 text-sm space-y-1">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            Live research steps
          </p>
          {latest.map((step) => (
            <p key={step.id} className="text-[var(--text)]">
              <span className="text-[var(--accent)]">{step.kind}</span>
              {" — "}
              {step.label}
            </p>
          ))}
        </div>
      );
    },
  });

  useLangGraphInterrupt<ClarifierInterrupt>({
    enabled: ({ eventValue }) => eventValue?.type === "clarifier",
    render: ({ event, resolve }) => {
      const value = event.value;
      const options = value.options ?? [];
      return (
        <div className="rounded-xl border border-[var(--accent)] bg-black/40 p-4 my-2 space-y-3">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            Clarifier
          </p>
          <p className="text-sm font-medium">{value.question}</p>
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="rounded-lg border border-[var(--glass-border)] px-3 py-2 text-left text-sm hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                onClick={() => resolve(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      );
    },
  });

  const logout = useCallback(async () => {
    await fetch("/api/login", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  return (
    <div className="min-h-screen p-4 md:p-6 ck-research">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Feature 2 · Deep research
          </p>
          <h1 className="display-font text-3xl mt-1">
            {state.company || "Name a company in chat"}
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Phase: {state.phase || "idle"}
            {state.followUpBudgetRemaining != null
              ? ` · follow-up searches left: ${state.followUpBudgetRemaining}`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm hover:border-[var(--accent)]"
        >
          Sign out
        </button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4 min-h-[75vh]">
        <section className="glass-panel rounded-2xl overflow-hidden min-h-[70vh] flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--glass-border)] text-sm text-[var(--muted)]">
            Ask for a company risk report. Clarifiers appear as selectable
            chips when the orchestrator needs them.
          </div>
          <div className="flex-1 min-h-0">
            <CopilotChat
              className="h-full"
              labels={{
                title: "Deep research agent",
                initial:
                  "Name a real public company to research. Example: Research Knorr-Bremse for supplier risk.",
              }}
            />
          </div>
        </section>

        <aside className="space-y-4">
          <section className="glass-panel rounded-2xl p-4">
            <h2 className="text-sm uppercase tracking-wide text-[var(--muted)] mb-3">
              Activity
            </h2>
            <ActivityFeed steps={state.activity ?? []} />
          </section>
          <section className="glass-panel rounded-2xl p-4">
            <h2 className="text-sm uppercase tracking-wide text-[var(--muted)] mb-3">
              Sources
            </h2>
            <SourceList sources={state.sources ?? []} />
          </section>
          <section className="glass-panel rounded-2xl p-4">
            <ReportPanel company={state.company ?? ""} report={state.report} />
          </section>
        </aside>
      </div>
    </div>
  );
}

export function ResearchHarness() {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="research_agent"
      useSingleEndpoint={false}
      showDevConsole={false}
    >
      <ResearchWorkspace />
    </CopilotKit>
  );
}
