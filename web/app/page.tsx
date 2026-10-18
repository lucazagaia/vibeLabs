"use client";

import { useState } from "react";

import { ChatPane } from "@/components/ChatPane";
import { CompareSuppliersTool } from "@/components/CompareSuppliersTool";
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
      <CompareSuppliersTool />
      {/* h-dvh + overflow-hidden: the page itself never scrolls; chat and dashboard scroll inside. */}
      <main className="grid h-dvh grid-cols-1 overflow-hidden md:grid-cols-[420px_1fr]">
        <section className="min-h-0 border-b border-black/10 md:border-r md:border-b-0 dark:border-white/10">
          <ChatPane active={active} onChange={setActive} />
        </section>
        {/* min-w-0: wide content (e.g. the 22-column benchmark) scrolls inside its card instead of widening the pane */}
        <section className="min-h-0 min-w-0 bg-black/[0.02] dark:bg-white/[0.02]">
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
