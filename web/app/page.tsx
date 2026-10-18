"use client";

import { ChatPane } from "@/components/ChatPane";
import { CompareSuppliersTool } from "@/components/CompareSuppliersTool";
import { Dashboard } from "@/components/Dashboard";
import { DashboardProvider } from "@/components/DashboardContext";
import { ShowNoticeTool } from "@/components/ShowNoticeTool";

export default function Home() {
  return (
    <DashboardProvider>
      <ShowNoticeTool />
      <CompareSuppliersTool />
      {/* h-dvh + overflow-hidden: the page itself never scrolls; chat and dashboard scroll inside. */}
      <main className="grid h-dvh grid-cols-1 overflow-hidden md:grid-cols-[420px_1fr]">
        <section className="min-h-0 border-b border-black/10 md:border-r md:border-b-0 dark:border-white/10">
          <ChatPane />
        </section>
        <section className="min-h-0 bg-black/[0.02] dark:bg-white/[0.02]">
          <Dashboard />
        </section>
      </main>
    </DashboardProvider>
  );
}
