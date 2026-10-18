"use client";

// Sticky bar at the top of every workspace page: sidebar toggle plus whatever title or
// breadcrumb the page passes in.
export function WorkspaceHeader({
  sidebarOpen,
  onToggleSidebar,
  children,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-black/10 bg-[#f7f8fa]/95 px-6 py-4 backdrop-blur">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs text-black/60 hover:bg-black/[0.03]"
        aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      >
        {sidebarOpen ? "←" : "→"}
      </button>
      {children}
    </div>
  );
}
