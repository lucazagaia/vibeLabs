"use client";

// The pages reachable from the left sidebar. "home" is the original chat-driven dashboard
// (notice cards from `show_notice`); the other three are the deterministic supplier views.
export const WORKSPACE_PAGES = [
  { id: "home", icon: "⌂", label: "Home" },
  { id: "suppliers", icon: "▦", label: "Suppliers" },
  { id: "favourites", icon: "★", label: "Favourites" },
  { id: "pool", icon: "◫", label: "Comparison Pool" },
] as const;

export type WorkspacePage = (typeof WORKSPACE_PAGES)[number]["id"];

export function pageTitle(page: WorkspacePage): string {
  return WORKSPACE_PAGES.find((item) => item.id === page)?.label ?? "Home";
}

export function WorkspaceSidebar({
  active,
  onChange,
  counts,
}: {
  active: WorkspacePage;
  onChange: (page: WorkspacePage) => void;
  counts: Partial<Record<WorkspacePage, number>>;
}) {
  return (
    <aside className="w-48 shrink-0 border-r border-black/10 bg-white px-3 py-4">
      <div className="px-2 pb-4 text-sm font-semibold tracking-tight">Supplier workspace</div>
      <nav className="space-y-1">
        {WORKSPACE_PAGES.map(({ id, icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active === id ? "page" : undefined}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${
              active === id ? "bg-black/[0.07] font-semibold text-black" : "text-black/55 hover:bg-black/[0.04]"
            }`}
          >
            <span className="w-4 text-center text-sm">{icon}</span>
            <span>{label}</span>
            {(counts[id] ?? 0) > 0 && (
              <span className="ml-auto rounded-full bg-black/[0.08] px-1.5 py-0.5 text-[10px]">{counts[id]}</span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
}
