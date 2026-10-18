"use client";

import type { ResearchSource } from "@/lib/research-report";

export function SourceList({ sources }: { sources: ResearchSource[] }) {
  if (!sources.length) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        Cited sources will list here with titles and URLs.
      </p>
    );
  }

  return (
    <ul className="max-h-[36vh] space-y-2 overflow-y-auto pr-1">
      {sources.map((src) => (
        <li
          key={`${src.url}-${src.lane}`}
          className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
        >
          <a
            href={src.url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-sm text-teal-700 hover:underline dark:text-teal-300"
          >
            {src.title}
          </a>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-black/50 dark:text-white/50">
            <span>{src.lane}</span>
            {src.date ? <span>{src.date}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
