"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";
import { useState } from "react";

import { AgentSwitch } from "./AgentSwitch";
import { AGENTS, type AgentId } from "./agents";

// Separate threads per agent: both chats stay mounted and only the active one is visible, so each keeps
// its own messages and scroll position, and flipping the switch never mixes histories.
export function ChatPane() {
  const [active, setActive] = useState<AgentId>("data_buddy");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-black/10 p-3 dark:border-white/10">
        <AgentSwitch active={active} onChange={setActive} />
      </div>
      {AGENTS.map((agent) => (
        <div key={agent.id} className={agent.id === active ? "min-h-0 flex-1" : "hidden"} aria-hidden={agent.id !== active}>
          <CopilotChat
            agentId={agent.id}
            labels={{ chatInputPlaceholder: agent.placeholder, welcomeMessageText: `Hi, I'm ${agent.label}.` }}
          />
        </div>
      ))}
    </div>
  );
}
