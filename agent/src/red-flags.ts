import type { ResearchFinding } from "./types.ts";

/** Rank concrete unresolved high-severity red flags for deep dives. */
export function rankRedFlags(findings: ResearchFinding[]): ResearchFinding[] {
  return findings
    .filter(
      (f) =>
        f.isRedFlag &&
        f.severity === "high" &&
        !f.resolved &&
        Boolean(f.eventName?.trim()),
    )
    .sort((a, b) => {
      const aSources = a.sourceUrls.length;
      const bSources = b.sourceUrls.length;
      return bSources - aSources;
    })
    .slice(0, 3);
}

export function downgradeResolvedFinding(
  finding: ResearchFinding,
  resolutionUrls: string[],
): ResearchFinding {
  return {
    ...finding,
    resolved: true,
    severity: finding.severity === "high" ? "moderate" : finding.severity,
    claim: `${finding.claim} Follow-up sources indicate this event has been resolved.`,
    sourceUrls: [...new Set([...finding.sourceUrls, ...resolutionUrls])],
  };
}

export function looksResolved(text: string): boolean {
  const t = text.toLowerCase();
  const positive = [
    "resolved",
    "settled",
    "dismissed",
    "closed the case",
    "no longer",
    "withdrawn",
    "acquitted",
    "cleared",
  ];
  const negative = [
    "unresolved",
    "ongoing",
    "pending",
    "still open",
    "continues",
    "under investigation",
  ];
  if (negative.some((w) => t.includes(w))) return false;
  return positive.some((w) => t.includes(w));
}
