// Supplier flags from the card engine, drawn as small badges next to a supplier.

const BADGES: Record<string, { label: string; className: string }> = {
  recommended: { label: "Recommended", className: "bg-emerald-600 text-white" },
  best: { label: "Best", className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" },
  worst: { label: "Worst", className: "bg-red-500/15 text-red-800 dark:text-red-300" },
  outlier: { label: "Outlier", className: "bg-violet-500/15 text-violet-800 dark:text-violet-300" },
  hidden_watchout: { label: "⚠ Hidden risk", className: "bg-amber-400/25 text-amber-900 dark:text-amber-200" },
};

// Spend is exposure, not risk: its extremes are "largest" and "smallest", not "worst" and "best".
const EXPOSURE_LABELS: Record<string, string> = { best: "Smallest", worst: "Largest" };

export function FlagBadges({ flags, exposure = false }: { flags: string[]; exposure?: boolean }) {
  return (
    <>
      {flags.filter((f) => BADGES[f]).map((f) => (
        <span
          key={f}
          className={`whitespace-nowrap rounded px-1.5 py-px text-[10px] font-medium ${exposure && EXPOSURE_LABELS[f] ? "bg-sky-500/15 text-sky-800 dark:text-sky-300" : BADGES[f].className}`}
        >
          {(exposure && EXPOSURE_LABELS[f]) || BADGES[f].label}
        </span>
      ))}
    </>
  );
}
