"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";

import { AgentSwitch } from "./AgentSwitch";
import { AGENTS, type AgentId } from "./agents";
import { ResearchChatExtras } from "./research/ResearchChatExtras";

// Separate threads per agent: both chats stay mounted and only the active one is visible, so each keeps
// its own messages and scroll position, and flipping the switch never mixes histories.
export function ChatPane({
  active,
  onChange,
}: {
  active: AgentId;
  onChange: (id: AgentId) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-black/10 p-3 dark:border-white/10">
        <AgentSwitch active={active} onChange={onChange} />
      </div>
      {active === "research_buddy" ? <ResearchChatExtras /> : null}
      {AGENTS.map((agent) => (
        <div
          key={agent.id}
          className={agent.id === active ? "min-h-0 flex-1" : "hidden"}
          aria-hidden={agent.id !== active}
        >
          <CopilotChat
            agentId={agent.id}
            labels={{
              chatInputPlaceholder: agent.placeholder,
              welcomeMessageText: agent.welcome,
            }}
          />
        </div>
      ))}
    </div>
  );
}
