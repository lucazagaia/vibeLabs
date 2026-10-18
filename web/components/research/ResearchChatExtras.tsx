"use client";

import {
  useCoAgentStateRender,
  useLangGraphInterrupt,
} from "@copilotkit/react-core";
import type {
  ClarifierOption,
  ResearchAgentState,
} from "@/lib/research-report";

type ClarifierInterrupt = {
  type?: string;
  questionId?: string;
  question?: string;
  options?: ClarifierOption[];
};

/** In-chat progress theme + clarifier chips for Research Buddy. */
export function ResearchChatExtras() {
  useCoAgentStateRender<ResearchAgentState>({
    name: "research_buddy",
    render: ({ state: live }) => {
      const latest = live?.activity?.slice(-3) ?? [];
      if (!latest.length) return null;
      return (
        <div className="my-2 space-y-1 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            Live research steps
          </p>
          {latest.map((step) => (
            <p key={step.id}>
              <span className="text-teal-700 dark:text-teal-300">{step.kind}</span>
              {" — "}
              {step.label}
            </p>
          ))}
        </div>
      );
    },
  });

  useLangGraphInterrupt<ClarifierInterrupt>({
    agentId: "research_buddy",
    enabled: ({ eventValue }) => eventValue?.type === "clarifier",
    render: ({ event, resolve }) => {
      const value = event.value;
      const options = value.options ?? [];
      return (
        <div className="my-2 space-y-3 rounded-xl border border-teal-500/40 bg-teal-500/5 p-4">
          <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">
            Clarifier
          </p>
          <p className="text-sm font-medium">{value.question}</p>
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="rounded-lg border border-black/10 px-3 py-2 text-left text-sm hover:border-teal-500 hover:bg-teal-500/10 dark:border-white/10"
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

  return null;
}
