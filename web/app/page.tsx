"use client";

import { useState } from "react";

import { ChatPane } from "@/components/ChatPane";
import { Dashboard } from "@/components/Dashboard";
import { DashboardProvider } from "@/components/DashboardContext";
import { ShowNoticeTool } from "@/components/ShowNoticeTool";
import type { AgentId } from "@/components/agents";
import { ResearchSidePanel } from "@/components/research/ResearchSidePanel";

export default function Home() {
  const [active, setActive] = useState<AgentId>("data_buddy");

  return (
    <DashboardProvider>
      <ShowNoticeTool />
      {/* h-dvh + overflow-hidden: the page itself never scrolls; chat and dashboard scroll inside. */}
      <main className="grid h-dvh grid-cols-1 overflow-hidden md:grid-cols-[420px_1fr]">
        <section className="min-h-0 border-b border-black/10 md:border-r md:border-b-0 dark:border-white/10">
          <ChatPane active={active} onChange={setActive} />
        </section>
        <section className="min-h-0 bg-black/[0.02] dark:bg-white/[0.02]">
          {active === "research_buddy" ? (
            <ResearchSidePanel />
          ) : (
            <Dashboard />
          )}
        </section>
      </main>
    </DashboardProvider>
  );
}
