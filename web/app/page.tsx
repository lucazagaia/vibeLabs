"use client";

import { useState } from "react";

import { ChatPane } from "@/components/ChatPane";
import { CompareSuppliersTool } from "@/components/CompareSuppliersTool";
import { Dashboard } from "@/components/Dashboard";
import { DashboardProvider } from "@/components/DashboardContext";
import { ShowNoticeTool } from "@/components/ShowNoticeTool";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import type { AgentId } from "@/components/agents";
import { ResearchSidePanel } from "@/components/research/ResearchSidePanel";

export default function Home() {
  const [active, setActive] = useState<AgentId>("data_buddy");

  return (
    <DashboardProvider>
      <ShowNoticeTool />
      <CompareSuppliersTool />
      {/* h-dvh + overflow-hidden: the page itself never scrolls; the workspace and chat scroll inside. */}
      <main className="grid h-dvh grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_420px]">
        {/* min-w-0: wide content (e.g. the 22-column benchmark) scrolls inside its card instead of widening the pane */}
        <section className="order-2 min-h-0 min-w-0 border-t border-black/10 md:order-1 md:border-t-0 md:border-r dark:border-white/10">
          <WorkspaceShell home={active === "research_buddy" ? <ResearchSidePanel /> : <Dashboard />} />
        </section>
        <section className="order-1 min-h-0 border-b border-black/10 md:order-2 md:border-b-0 dark:border-white/10">
          <ChatPane active={active} onChange={setActive} />
        </section>
      </main>
    </DashboardProvider>
  );
}
