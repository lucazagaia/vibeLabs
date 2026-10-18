"use client";

import { sourceDomain, type ResearchSource } from "@/lib/research-report";

const LANE_LABEL: Record<ResearchSource["lane"], string> = {
  financial: "Financial",
  esg: "ESG",
  compliance: "Compliance",
  news: "News",
  red_flag: "Red flag",
  follow_up: "Follow-up",
};

function shortDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Sources in the order research found them; new ones fade in as they arrive. */
export function SourceList({
  sources,
  collecting,
}: {
  sources: ResearchSource[];
  collecting: boolean;
}) {
  if (!sources.length && !collecting) return null;

  return (
    <section>
      <h2 className="mb-2 flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
        Sources
        <span className="font-normal normal-case tracking-normal text-black/35 dark:text-white/35">
          {sources.length ? sources.length : collecting ? "collecting…" : ""}
        </span>
      </h2>
      {sources.length ? (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 bg-white dark:divide-white/5 dark:border-white/10 dark:bg-neutral-900">
          {sources.map((src) => {
            const date = shortDate(src.date);
            return (
              <li key={`${src.url}-${src.lane}`} className="research-fade-in">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  title={src.url}
                  className="flex min-w-0 items-center gap-3 px-3 py-2 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <span className="w-28 shrink-0 truncate font-medium text-teal-700 dark:text-teal-300">
                    {sourceDomain(src.url)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-black/70 dark:text-white/70">
                    {src.title}
                  </span>
                  <span className="hidden shrink-0 text-black/35 sm:inline dark:text-white/35">
                    {LANE_LABEL[src.lane]}
                    {date ? ` · ${date}` : ""}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
