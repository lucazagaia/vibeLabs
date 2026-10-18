"use client";

import { ChatPane } from "@/components/ChatPane";
import { Dashboard } from "@/components/Dashboard";
import { DashboardProvider } from "@/components/DashboardContext";
import { ShowNoticeTool } from "@/components/ShowNoticeTool";

export default function Home() {
  return (
    <DashboardProvider>
      <ShowNoticeTool />
      {/* h-dvh + overflow-hidden: the page itself never scrolls; chat and dashboard scroll inside. */}
      <main className="grid h-dvh grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_420px]">
        <section className="order-2 min-h-0 border-t border-black/10 md:order-1 md:border-t-0 md:border-r dark:border-white/10">
          <Dashboard />
        </section>
        <section className="order-1 min-h-0 border-b border-black/10 md:order-2 md:border-b-0 dark:border-white/10">
          <ChatPane />
        </section>
      </main>
    </DashboardProvider>
  );
}
