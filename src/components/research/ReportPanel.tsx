"use client";

import type { ResearchReportBody } from "@/lib/research-report";

export function ReportPanel({
  company,
  report,
}: {
  company: string;
  report: ResearchReportBody | null;
}) {
  if (!report) {
    return (
      <p className="text-sm text-[var(--muted)]">
        The typed risk report appears here after synthesis.
      </p>
    );
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <h2 className="display-font text-2xl">
          Risk report{company ? ` · ${company}` : ""}
        </h2>
        <p className="text-sm text-[var(--muted)] mt-1 whitespace-pre-wrap">
          {report.summary}
        </p>
      </div>
      <div className="rounded-xl border border-[var(--glass-border)] bg-black/15 px-3 py-2">
        <h3 className="text-sm uppercase tracking-wide text-[var(--muted)]">
          Red flags
        </h3>
        <p className="text-sm mt-1">{report.redFlagSummary}</p>
      </div>
      {report.sections.map((section) => (
        <section
          key={section.lane}
          className="rounded-xl border border-[var(--glass-border)] bg-black/15 px-3 py-3"
        >
          <h3 className="font-semibold">{section.title}</h3>
          <p className="text-sm mt-2 whitespace-pre-wrap text-[var(--muted)]">
            {section.body}
          </p>
        </section>
      ))}
    </div>
  );
}
