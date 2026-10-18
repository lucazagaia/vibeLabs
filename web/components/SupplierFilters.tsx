"use client";

export type SupplierFilterState = {
  query: string;
  riskLevels: string[];
  sourcing: string[];
  complexity: string[];
  minRisk: string;
  maxRisk: string;
  minDelivery: string;
  minVolume: string;
  onlyFavourites: boolean;
  onlyPool: boolean;
};

export const EMPTY_FILTERS: SupplierFilterState = {
  query: "",
  riskLevels: [],
  sourcing: [],
  complexity: [],
  minRisk: "",
  maxRisk: "",
  minDelivery: "",
  minVolume: "",
  onlyFavourites: false,
  onlyPool: false,
};

const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];
const SOURCING_LEVELS = ["Low", "Medium", "High"];
const COMPLEXITY_LEVELS = ["Simple", "Moderate", "Complex"];

export function activeFilterCount(filters: SupplierFilterState) {
  return (
    (filters.query.trim() ? 1 : 0) +
    filters.riskLevels.length +
    filters.sourcing.length +
    filters.complexity.length +
    (filters.minRisk ? 1 : 0) +
    (filters.maxRisk ? 1 : 0) +
    (filters.minDelivery ? 1 : 0) +
    (filters.minVolume ? 1 : 0) +
    (filters.onlyFavourites ? 1 : 0) +
    (filters.onlyPool ? 1 : 0)
  );
}

// The filter panel above the supplier table: text search, the three categorical levels as chips,
// numeric floors and ceilings, and the two saved-list toggles.
export function SupplierFilters({
  filters,
  onChange,
  showFavouriteToggle = true,
}: {
  filters: SupplierFilterState;
  onChange: (next: SupplierFilterState) => void;
  showFavouriteToggle?: boolean;
}) {
  const count = activeFilterCount(filters);

  function set<K extends keyof SupplierFilterState>(key: K, value: SupplierFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleIn(key: "riskLevels" | "sourcing" | "complexity", option: string) {
    const current = filters[key];
    set(key, current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  }

  return (
    <details open className="group overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5">
        <span className="text-sm font-semibold">Filters</span>
        {count > 0 && <span className="rounded-full bg-black/[0.07] px-2 py-0.5 text-[10px] font-medium dark:bg-white/[0.07]">{count} active</span>}
        <span className="ml-auto flex items-center gap-3">
          {count > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => { event.preventDefault(); onChange({ ...EMPTY_FILTERS }); }}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onChange({ ...EMPTY_FILTERS }); } }}
              className="rounded-lg border border-black/10 px-2.5 py-1 text-[11px] font-medium text-black/55 hover:bg-black/[0.03] dark:border-white/10 dark:text-white/55 dark:hover:bg-white/[0.03]"
            >
              Clear all
            </span>
          )}
          <span className="text-black/30 transition-transform group-open:rotate-180 dark:text-white/30">▾</span>
        </span>
      </summary>

      <div className="space-y-4 border-t border-black/[0.07] px-5 py-4 dark:border-white/[0.07]">
        <input
          value={filters.query}
          onChange={(event) => set("query", event.target.value)}
          placeholder="Search supplier or ID"
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs outline-none ring-black/10 focus:ring-2 dark:border-white/10 dark:bg-neutral-900 dark:ring-white/10"
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <ChipGroup label="Total risk level" options={RISK_LEVELS} selected={filters.riskLevels} onToggle={(option) => toggleIn("riskLevels", option)} />
          <ChipGroup label="Sourcing risk" options={SOURCING_LEVELS} selected={filters.sourcing} onToggle={(option) => toggleIn("sourcing", option)} />
          <ChipGroup label="Supply chain" options={COMPLEXITY_LEVELS} selected={filters.complexity} onToggle={(option) => toggleIn("complexity", option)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Total risk from" value={filters.minRisk} onChange={(value) => set("minRisk", value)} placeholder="0" />
          <NumberField label="Total risk up to" value={filters.maxRisk} onChange={(value) => set("maxRisk", value)} placeholder="100" />
          <NumberField label="Delivery rating ≥" value={filters.minDelivery} onChange={(value) => set("minDelivery", value)} placeholder="%" />
          <NumberField label="PO exposure ≥" value={filters.minVolume} onChange={(value) => set("minVolume", value)} placeholder="EUR" />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-black/[0.05] pt-3 dark:border-white/[0.05]">
          {showFavouriteToggle && (
            <Toggle label="★ Favourites only" on={filters.onlyFavourites} onClick={() => set("onlyFavourites", !filters.onlyFavourites)} />
          )}
          <Toggle label="◫ In comparison pool" on={filters.onlyPool} onClick={() => set("onlyPool", !filters.onlyPool)} />
        </div>
      </div>
    </details>
  );
}

function ChipGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (option: string) => void }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-black/40 dark:text-white/40">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${on ? "border-black/15 bg-black/[0.07] font-semibold text-black dark:border-white/15 dark:bg-white/[0.07] dark:text-white" : "border-black/10 bg-white text-black/55 hover:bg-black/[0.03] dark:border-white/10 dark:bg-neutral-900 dark:text-white/55 dark:hover:bg-white/[0.03]"}`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-wide text-black/40 dark:text-white/40">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs outline-none ring-black/10 focus:ring-2 dark:border-white/10 dark:bg-neutral-900 dark:ring-white/10"
      />
    </label>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${on ? "border-black/15 bg-black/[0.07] text-black dark:border-white/15 dark:bg-white/[0.07] dark:text-white" : "border-black/10 bg-white text-black/55 hover:bg-black/[0.03] dark:border-white/10 dark:bg-neutral-900 dark:text-white/55 dark:hover:bg-white/[0.03]"}`}
    >
      {label}
    </button>
  );
}
