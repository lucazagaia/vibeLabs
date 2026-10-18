import {
  downgradeResolvedFinding,
  looksResolved,
  rankRedFlags,
} from "../red-flags.ts";
import type { ResearchState } from "../state.ts";
import {
  allowlistedUrls,
  tavilySearch,
  toSources,
} from "../tavily.ts";
import { activity, mergeSources, replaceFinding } from "../utils.ts";

export async function redFlagDivesNode(
  state: ResearchState,
): Promise<Partial<ResearchState>> {
  const candidates = rankRedFlags(state.findings);
  const budget = state.searchBudget;
  let findings = [...state.findings];
  let sources = [...state.sources];
  const steps: ResearchState["activity"] = [];

  if (candidates.length === 0) {
    steps.push(
      activity({
        kind: "red_flag",
        lane: "red_flag",
        label: "No concrete unresolved red flags",
        detail: "Skipping deep dives.",
        status: "skipped",
      }),
    );
    return {
      phase: "synthesize",
      activity: steps,
      findings,
      sources,
    };
  }

  for (const candidate of candidates) {
    const query = `${state.company} ${candidate.eventName} resolution status latest`;
    steps.push(
      activity({
        kind: "red_flag",
        lane: "red_flag",
        label: `Deep dive: ${candidate.eventName}`,
        detail: query,
        status: "running",
      }),
    );

    try {
      const hits = await tavilySearch({
        query,
        mode: "news",
        budget,
        budgetKey: "red_flag",
        kind: "red_flag",
      });
      sources = mergeSources(sources, toSources(hits, "red_flag"));
      const blob = hits.map((h) => `${h.title} ${h.content}`).join("\n");
      const urls = allowlistedUrls(
        hits.map((h) => h.url),
        hits.map((h) => h.url),
      );

      if (hits.length > 0 && looksResolved(blob)) {
        findings = replaceFinding(
          findings,
          downgradeResolvedFinding(candidate, urls),
        );
        steps.push(
          activity({
            kind: "red_flag",
            lane: "red_flag",
            label: `Resolved: ${candidate.eventName}`,
            detail: "Severity downgraded after follow-up sources.",
            status: "done",
          }),
        );
      } else {
        findings = replaceFinding(findings, {
          ...candidate,
          sourceUrls: [...new Set([...candidate.sourceUrls, ...urls])],
        });
        steps.push(
          activity({
            kind: "red_flag",
            lane: "red_flag",
            label: `Still open: ${candidate.eventName}`,
            detail:
              hits.length === 0
                ? "No recent sources found."
                : "Sources do not show a clear resolution.",
            status: "done",
          }),
        );
      }
    } catch (err) {
      steps.push(
        activity({
          kind: "red_flag",
          lane: "red_flag",
          label: `Deep dive failed: ${candidate.eventName}`,
          detail: err instanceof Error ? err.message : "error",
          status: "done",
        }),
      );
    }
  }

  return {
    phase: "synthesize",
    findings,
    sources,
    searchBudget: budget,
    activity: steps,
  };
}
