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
      <p className="text-sm text-black/50 dark:text-white/50">
        The typed risk report appears here after synthesis.
      </p>
    );
  }

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Risk report{company ? ` · ${company}` : ""}
        </h2>
        <p className="mt-1 whitespace-pre-wrap text-sm text-black/60 dark:text-white/60">
          {report.summary}
        </p>
      </div>
      <div className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
        <h3 className="text-sm uppercase tracking-wide text-black/40 dark:text-white/40">
          Red flags
        </h3>
        <p className="mt-1 text-sm">{report.redFlagSummary}</p>
      </div>
      {report.sections.map((section) => (
        <section
          key={section.lane}
          className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-3 dark:border-white/10 dark:bg-white/[0.04]"
        >
          <h3 className="font-semibold">{section.title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-black/60 dark:text-white/60">
            {section.body}
          </p>
        </section>
      ))}
    </div>
  );
}
