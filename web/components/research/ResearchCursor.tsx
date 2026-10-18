"use client";

import { useEffect, useReducer } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { liveStatus, type ResearchAgentState } from "@/lib/research-report";
import { StatusLine } from "./StatusLine";

/**
 * Research Buddy's stand-in for the chat's "running" dot: one line saying what it is doing now.
 * The chat only renders it while a run is in progress, after the newest message.
 */
export function ResearchCursor() {
  const { agent } = useAgent({ agentId: "research_buddy" });
  // Inside the chat's memoized cursor slot, useAgent only re-renders on run-status events, so
  // subscribe to state changes directly (as the chat's own message view does).
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const subscription = agent.subscribe({ onStateChanged: rerender });
    return () => subscription.unsubscribe();
  }, [agent]);

  const state = agent.state as Partial<ResearchAgentState> | undefined;
  // Until this run's first state snapshot lands, the state is still the previous run's. A thread
  // that already has a report always goes to the follow-up node next.
  const live = liveStatus(state) ?? {
    label: state?.report ? "Checking the report…" : "Reading your request…",
  };
  return (
    <div className="px-1">
      <StatusLine label={live.label} detail={live.detail} />
    </div>
  );
}
