"use client";

import type { ResearchSource } from "@/lib/research-report";

export function SourceList({ sources }: { sources: ResearchSource[] }) {
  if (!sources.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Cited sources will list here with titles and URLs.
      </p>
    );
  }

  return (
    <ul className="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
      {sources.map((src) => (
        <li
          key={`${src.url}-${src.lane}`}
          className="rounded-xl border border-[var(--glass-border)] bg-black/15 px-3 py-2"
        >
          <a
            href={src.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--accent)] hover:underline break-all"
          >
            {src.title}
          </a>
          <div className="text-xs text-[var(--muted)] mt-1 flex flex-wrap gap-2">
            <span>{src.lane}</span>
            {src.date ? <span>{src.date}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
