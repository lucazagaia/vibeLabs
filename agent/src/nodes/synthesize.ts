import { AIMessage } from "@langchain/core/messages";
import { domainLinks } from "../links.ts";
import { getChatModel } from "../model.ts";
import { rankRedFlags } from "../red-flags.ts";
import type { ResearchState } from "../state.ts";
import {
  ALL_LANES,
  LANE_TITLES,
  type LaneReportSection,
  type ResearchReportBody,
} from "../types.ts";
import { activity, messageText, parseJsonObject } from "../utils.ts";

export async function synthesizeNode(
  state: ResearchState,
): Promise<Partial<ResearchState>> {
  const openFlags = rankRedFlags(state.findings);
  const redFlagSummary =
    openFlags.length === 0
      ? "No concrete unresolved red flags were confirmed after research."
      : `Open red flags: ${openFlags.map((f) => f.eventName).join("; ")}.`;

  const sectionsFallback: LaneReportSection[] = ALL_LANES.map((lane) => {
    const laneFindings = state.findings.filter((f) => f.lane === lane);
    return {
      lane,
      title: LANE_TITLES[lane],
      body: laneFindings.map((f) => `• ${f.claim} [${f.severity}]`).join("\n"),
      findingIds: laneFindings.map((f) => f.id),
    };
  });

  let report: ResearchReportBody = {
    summary: `${state.company} public-source risk scan. ${redFlagSummary}`,
    sections: sectionsFallback,
    redFlagSummary,
  };

  try {
    const model = getChatModel("orchestrator", 0.2);
    const payload = {
      company: state.company,
      findings: state.findings,
      sources: state.sources.map((s) => ({
        title: s.title,
        url: s.url,
        date: s.date,
        lane: s.lane,
      })),
      clarifierAnswers: state.clarifierAnswers,
    };
    const prompt = `Write a short cited supplier risk report from these findings.
Do NOT invent 0-100 scores. Only mention URLs that appear in findings/sources.
Return ONLY JSON:
{
  "summary": "2-4 short paragraphs with inline [title](url) citations where possible",
  "sections": [{"lane":"financial","title":"...","body":"...","findingIds":["..."]}],
  "redFlagSummary": "..."
}

Data:
${JSON.stringify(payload, null, 2)}`;

    const res = await model.invoke([
      { role: "system", content: "Return strict JSON only." },
      { role: "user", content: prompt },
    ]);
    const parsed = parseJsonObject<ResearchReportBody>(messageText(res.content));
    if (parsed?.summary && parsed.sections?.length) {
      report = {
        summary: parsed.summary,
        sections: parsed.sections,
        redFlagSummary: parsed.redFlagSummary || redFlagSummary,
      };
    }
  } catch {
    // Keep fallback report.
  }

  return {
    phase: "done",
    researched: true,
    report,
    followUpBudgetRemaining: state.searchBudget?.followUpRemaining ?? 1,
    activity: [
      activity({
        kind: "synthesize",
        lane: "orchestrator",
        label: "Risk report ready",
        detail: redFlagSummary,
        status: "done",
      }),
    ],
    messages: [
      new AIMessage(
        `## Risk report — ${state.company}\n\n${domainLinks(report.summary)}\n\n### Red flags\n${domainLinks(report.redFlagSummary)}\n\nAsk a follow-up about this report, or start a new thread for a different company.`,
      ),
    ],
  };
}
