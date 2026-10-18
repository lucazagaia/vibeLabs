"use client";

/** One clean line for what Research Buddy is doing right now, with a light sweep while it works. */
export function StatusLine({
  label,
  detail,
  active = true,
}: {
  label: string;
  detail?: string;
  active?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-0 items-center gap-2 text-sm"
    >
      {active ? (
        <span className="relative flex size-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-500/60" />
          <span className="relative inline-flex size-2 rounded-full bg-teal-500" />
        </span>
      ) : (
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      )}
      <span
        className={`shrink-0 font-medium text-black/75 dark:text-white/80 ${active ? "research-shimmer" : ""}`}
      >
        {label}
      </span>
      {detail ? (
        <span className="min-w-0 truncate text-black/40 dark:text-white/40">
          {detail}
        </span>
      ) : null}
    </div>
  );
}
