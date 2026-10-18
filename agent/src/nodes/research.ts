import { getChatModel } from "../model.ts";
import type { ResearchState } from "../state.ts";
import {
  allowlistedUrls,
  createSearchBudget,
  laneSearchMode,
  SearchBudgetError,
  tavilySearch,
  toSources,
  type SearchBudget,
} from "../tavily.ts";
import {
  ALL_LANES,
  LANE_FOCUS,
  LANE_TITLES,
  type ResearchFinding,
  type ResearchLane,
  type ResearchSource,
} from "../types.ts";
import {
  activity,
  mergeSources,
  messageText,
  parseJsonObject,
  uid,
} from "../utils.ts";

type LaneResultJson = {
  findings?: Array<{
    claim?: string;
    severity?: ResearchFinding["severity"];
    isRedFlag?: boolean;
    eventName?: string | null;
    sourceUrls?: string[];
    documentDate?: string | null;
  }>;
  nextQuery?: string | null;
  done?: boolean;
  note?: string;
};

async function researchLane(
  company: string,
  lane: ResearchLane,
  clarifierAnswers: Record<string, string>,
  budget: SearchBudget,
): Promise<{
  findings: ResearchFinding[];
  sources: ResearchSource[];
  activity: ResearchState["activity"];
}> {
  const steps: ResearchState["activity"] = [];
  const findings: ResearchFinding[] = [];
  const sources: ResearchSource[] = [];
  const mode = laneSearchMode(lane);
  const contextBits = Object.entries(clarifierAnswers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");

  let query = `${company} ${LANE_FOCUS[lane]}`;
  let pivots = 0;

  steps.push(
    activity({
      kind: "search",
      lane,
      label: `Searching ${LANE_TITLES[lane]}`,
      detail: query,
      status: "running",
    }),
  );

  try {
    while ((budget.laneSearches[lane] ?? 0) < 4) {
      const hits = await tavilySearch({
        query,
        mode,
        budget,
        budgetKey: lane,
        kind: "lane",
      });
      sources.push(...toSources(hits, lane));

      steps.push(
        activity({
          kind: pivots === 0 ? "search" : "pivot",
          lane,
          label:
            pivots === 0
              ? `Tavily returned ${hits.length} sources`
              : `Pivot search #${pivots}`,
          detail: query,
          status: "done",
        }),
      );

      if (hits.length === 0) {
        findings.push({
          id: uid("find"),
          lane,
          claim: `No usable public sources found for ${LANE_TITLES[lane]}.`,
          severity: "unknown",
          isRedFlag: false,
          eventName: null,
          resolved: false,
          sourceUrls: [],
          documentDate: null,
        });
        break;
      }

      const model = getChatModel("worker", 0.1);
      const evidence = hits
        .map(
          (h, i) =>
            `[${i + 1}] ${h.title}\nURL: ${h.url}\nDate: ${h.publishedDate ?? "unknown"}\n${h.content}`,
        )
        .join("\n\n");

      const prompt = `You are the ${lane} researcher for supplier risk.
Company: ${company}
Lane focus: ${LANE_FOCUS[lane]}
Buyer clarifiers: ${contextBits || "none"}
Search mode: ${mode} (${mode === "news" ? "only cite sources from the last 12 months" : "filings and current reports allowed; include documentDate"})

Evidence (you may ONLY cite URLs listed here):
${evidence}

Return ONLY JSON:
{
  "findings": [{
    "claim": "one sentence claim",
    "severity": "low|moderate|high|unknown",
    "isRedFlag": false,
    "eventName": null,
    "sourceUrls": ["https://..."],
    "documentDate": "YYYY-MM-DD or null"
  }],
  "nextQuery": "optional pivot query or null",
  "done": true,
  "note": "short reasoning"
}

Rules:
- No invented 0-100 scores.
- isRedFlag=true only for a concrete unresolved event (lawsuit, recall, accident, breach, sanction, strike, going-concern warning) with eventName set.
- If evidence is thin, severity=unknown.
- Prefer 1-3 findings.`;

      const res = await model.invoke([
        { role: "system", content: "Return strict JSON only." },
        { role: "user", content: prompt },
      ]);

      const parsed = parseJsonObject<LaneResultJson>(messageText(res.content));
      const allowed = hits.map((h) => h.url);

      steps.push(
        activity({
          kind: "reason",
          lane,
          label: parsed?.note || "Reasoning over sources",
          status: "done",
        }),
      );

      for (const f of parsed?.findings ?? []) {
        const urls = allowlistedUrls(f.sourceUrls ?? [], allowed);
        if (!f.claim) continue;
        findings.push({
          id: uid("find"),
          lane,
          claim: f.claim,
          severity: f.severity ?? "unknown",
          isRedFlag: Boolean(f.isRedFlag && f.eventName),
          eventName: f.eventName ?? null,
          resolved: false,
          sourceUrls: urls,
          documentDate: f.documentDate ?? null,
        });
      }

      if (parsed?.done !== false || !parsed?.nextQuery) break;
      if ((budget.laneSearches[lane] ?? 0) >= 4) break;
      pivots += 1;
      query = parsed.nextQuery;
    }
  } catch (err) {
    const msg =
      err instanceof SearchBudgetError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Lane search failed";
    steps.push(
      activity({
        kind: "reason",
        lane,
        label: `Lane stopped: ${msg}`,
        status: "done",
      }),
    );
    if (findings.length === 0) {
      findings.push({
        id: uid("find"),
        lane,
        claim: `Unable to complete ${LANE_TITLES[lane]} research (${msg}).`,
        severity: "unknown",
        isRedFlag: false,
        eventName: null,
        resolved: false,
        sourceUrls: [],
        documentDate: null,
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      id: uid("find"),
      lane,
      claim: `No cited findings for ${LANE_TITLES[lane]}.`,
      severity: "unknown",
      isRedFlag: false,
      eventName: null,
      resolved: false,
      sourceUrls: [],
      documentDate: null,
    });
  }

  return { findings, sources, activity: steps };
}

export async function researchNode(
  state: ResearchState,
): Promise<Partial<ResearchState>> {
  const budget = state.searchBudget ?? createSearchBudget(state.followUpBudgetRemaining);
  const laneResults = await Promise.all(
    ALL_LANES.map((lane) =>
      researchLane(state.company, lane, state.clarifierAnswers, budget),
    ),
  );

  const findings = laneResults.flatMap((r) => r.findings);
  const sources = laneResults.reduce(
    (acc, r) => mergeSources(acc, r.sources),
    state.sources,
  );
  const steps = laneResults.flatMap((r) => r.activity);

  return {
    phase: "red_flags",
    findings,
    sources,
    searchBudget: budget,
    activity: steps,
  };
}
