"use client";

import { useState } from "react";

import { agentLabel } from "./agents";
import { ComparisonPool } from "./ComparisonPool";
import { useDashboard } from "./DashboardContext";
import { HomeView } from "./HomeView";
import { SupplierWorkspace, type SupplierPage } from "./SupplierWorkspace";
import type { Supplier } from "./supplierMetrics";
import { useFavourites } from "./useFavourites";
import { usePool } from "./usePool";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceSidebar, type WorkspacePage } from "./WorkspaceSidebar";

const SUPPLIER_PAGES: SupplierPage[] = ["suppliers", "favourites"];

// The workspace shell: sidebar on the left, the active page beside it. The chat lives outside this
// component (app/page.tsx) and stays on the right on every page.
export function Dashboard() {
  const { notices } = useDashboard();
  const [page, setPage] = useState<WorkspacePage>("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const { favourites, toggleFavourite } = useFavourites();
  const { pool } = usePool();

  function openPage(next: WorkspacePage) {
    setPage(next);
    setSelected(null);
  }

  function openSupplier(supplier: Supplier) {
    setPage("suppliers");
    setSelected(supplier);
  }

  return (
    <div className="relative flex h-full min-h-0 bg-[#f7f8fa]">
      {sidebarOpen && (
        <WorkspaceSidebar active={page} onChange={openPage} counts={{ favourites: favourites.length, pool: pool.length }} />
      )}

      {/* Pages stay mounted so filters, sorting and scroll survive a trip through the sidebar. */}
      <div
        className={page === "home" ? "flex min-w-0 flex-1 flex-col overflow-hidden" : "hidden"}
        aria-hidden={page !== "home"}
      >
        <WorkspaceHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)}>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-black/35">Workspace</p>
            <h1 className="text-lg font-semibold tracking-tight">Home</h1>
          </div>
        </WorkspaceHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <HomeView />
        </div>
      </div>

      {SUPPLIER_PAGES.map((supplierPage) => (
        <div
          key={supplierPage}
          className={page === supplierPage ? "flex min-w-0 flex-1" : "hidden"}
          aria-hidden={page !== supplierPage}
        >
          <SupplierWorkspace
            page={supplierPage}
            active={page === supplierPage}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            favourites={favourites}
            onToggleFavourite={toggleFavourite}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
      ))}

      <div className={page === "pool" ? "flex min-w-0 flex-1" : "hidden"} aria-hidden={page !== "pool"}>
        <ComparisonPool
          active={page === "pool"}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onOpenSupplier={openSupplier}
        />
      </div>

      {/* On the supplier pages the agent's notice cards float over the page; Home shows them in full. */}
      {page !== "home" && notices.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-20 w-72 space-y-2">
          {notices.map((notice) => (
            <article
              key={notice.id}
              className="pointer-events-auto rounded-xl border border-black/10 bg-white/95 p-3 shadow-lg backdrop-blur"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-black/40">
                Notice · {agentLabel(notice.agentId)}
              </p>
              <p className="mt-1 text-xs">{notice.text}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
