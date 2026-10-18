"use client";

import type {
  FindingSeverity,
  ResearchFinding,
  ResearchReportBody,
} from "@/lib/research-report";

import { RichText } from "./RichText";

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  high: 3,
  moderate: 2,
  low: 1,
  unknown: 0,
};

const SEVERITY_STYLE: Record<FindingSeverity, string> = {
  high: "bg-red-500/10 text-red-700 dark:text-red-300",
  moderate: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  unknown: "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50",
};

function worstSeverity(findings: ResearchFinding[]): FindingSeverity | null {
  if (!findings.length) return null;
  return findings.reduce<FindingSeverity>(
    (worst, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst] ? f.severity : worst),
    "unknown",
  );
}

export function ReportPanel({
  company,
  report,
  findings,
}: {
  company: string;
  report: ResearchReportBody | null;
  findings: ResearchFinding[];
}) {
  if (!report) {
    return (
      <div className="rounded-xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-black/45 dark:border-white/15 dark:text-white/45">
        The risk report appears here once research is done.
      </div>
    );
  }

  const openFlags = findings.filter((f) => f.isRedFlag && !f.resolved);

  return (
    <article className="space-y-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
          Risk report
        </p>
        <h2 className="text-lg font-semibold tracking-tight">{company}</h2>
      </header>

      <RichText text={report.summary} className="text-black/75 dark:text-white/75" />

      <div
        className={`rounded-xl px-4 py-3 ${
          openFlags.length
            ? "bg-red-500/[0.07] ring-1 ring-red-500/20"
            : "bg-emerald-500/[0.07] ring-1 ring-emerald-500/20"
        }`}
      >
        <p
          className={`text-xs font-medium uppercase tracking-wide ${
            openFlags.length
              ? "text-red-700 dark:text-red-300"
              : "text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {openFlags.length
            ? `${openFlags.length} open red flag${openFlags.length > 1 ? "s" : ""}`
            : "No open red flags"}
        </p>
        <RichText text={report.redFlagSummary} className="mt-1" />
      </div>

      <div className="space-y-3">
        {report.sections.map((section) => {
          const severity = worstSeverity(findings.filter((f) => f.lane === section.lane));
          return (
            <section
              key={section.lane}
              className="border-t border-black/5 pt-3 dark:border-white/10"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{section.title}</h3>
                {severity ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${SEVERITY_STYLE[severity]}`}
                  >
                    {severity === "unknown" ? "thin evidence" : `${severity} risk`}
                  </span>
                ) : null}
              </div>
              <RichText text={section.body} className="text-black/70 dark:text-white/70" />
            </section>
          );
        })}
      </div>
    </article>
  );
}
