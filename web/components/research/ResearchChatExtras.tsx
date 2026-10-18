"use client";

import { useLangGraphInterrupt } from "@copilotkit/react-core";
import type { ClarifierOption } from "@/lib/research-report";

type ClarifierInterrupt = {
  type?: string;
  questionId?: string;
  question?: string;
  options?: ClarifierOption[];
};

/** Clarifier chips for Research Buddy. The live status line is the chat cursor (ResearchCursor). */
export function ResearchChatExtras() {
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
