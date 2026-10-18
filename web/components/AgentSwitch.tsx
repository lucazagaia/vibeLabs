"use client";

import { AGENTS, type AgentId } from "./agents";

// Deterministic switch: the user, not a model, picks which agent the chat talks to.
export function AgentSwitch({ active, onChange }: { active: AgentId; onChange: (id: AgentId) => void }) {
  return (
    <div role="tablist" aria-label="Choose agent" className="flex gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/10">
      {AGENTS.map((agent) => {
        const selected = agent.id === active;
        return (
          <button
            key={agent.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(agent.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white"
                : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
            }`}
          >
            {agent.label}
          </button>
        );
      })}
    </div>
  );
}
