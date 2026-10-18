import { AIMessage, isHumanMessage } from "@langchain/core/messages";
import { getChatModel } from "../model.ts";
import type { ResearchState } from "../state.ts";
import {
  allowlistedUrls,
  SearchBudgetError,
  tavilySearch,
  toSources,
} from "../tavily.ts";
import {
  activity,
  mergeSources,
  messageText,
  parseJsonObject,
} from "../utils.ts";

function lastHumanText(state: ResearchState): string {
  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    const msg = state.messages[i];
    if (isHumanMessage(msg) || msg._getType?.() === "human") {
      return messageText(msg.content);
    }
  }
  return "";
}

export async function followUpNode(
  state: ResearchState,
): Promise<Partial<ResearchState>> {
  const question = lastHumanText(state);
  const budget = state.searchBudget;
  let sources = [...state.sources];
  const steps: ResearchState["activity"] = [];
  let extraEvidence = "";

  const needsSearch =
    /source|url|latest|news|update|confirm|more|detail|when|lawsuit|recall|breach/i.test(
      question,
    ) && (budget?.followUpRemaining ?? 0) > 0;

  if (needsSearch && budget) {
    try {
      const query = `${state.company} ${question}`;
      steps.push(
        activity({
          kind: "follow_up",
          lane: "orchestrator",
          label: "One follow-up search",
          detail: query,
          status: "running",
        }),
      );
      const hits = await tavilySearch({
        query,
        mode: "news",
        budget,
        budgetKey: "follow_up",
        kind: "follow_up",
      });
      sources = mergeSources(sources, toSources(hits, "follow_up"));
      const allowed = hits.map((h) => h.url);
      extraEvidence = hits
        .map((h) => `${h.title} (${h.url}): ${h.content}`)
        .join("\n");
      allowlistedUrls(allowed, allowed);
      steps.push(
        activity({
          kind: "follow_up",
          lane: "orchestrator",
          label: `Follow-up search returned ${hits.length} sources`,
          status: "done",
        }),
      );
    } catch (err) {
      steps.push(
        activity({
          kind: "follow_up",
          lane: "orchestrator",
          label:
            err instanceof SearchBudgetError
              ? "Follow-up search budget already used"
              : `Follow-up search failed: ${err instanceof Error ? err.message : "error"}`,
          status: "done",
        }),
      );
    }
  } else {
    steps.push(
      activity({
        kind: "follow_up",
        lane: "orchestrator",
        label: "Answering from existing report",
        detail: "No extra search.",
        status: "done",
      }),
    );
  }

  let answer =
    "I can only answer from the current report for this company. Start a new thread to research a different company.";

  try {
    const model = getChatModel("orchestrator", 0.2);
    const prompt = `Answer the buyer's follow-up using ONLY the existing report, findings, sources, and optional extra evidence.
Do not restart research. Do not invent 0-100 scores. Only cite URLs present in the data.
If they name a different company, tell them to start a new thread.

Company: ${state.company}
Question: ${question}

Report:
${JSON.stringify(state.report)}

Findings:
${JSON.stringify(state.findings)}

Sources:
${JSON.stringify(state.sources)}

Extra evidence:
${extraEvidence || "none"}

Return ONLY JSON: {"answer":"markdown string"}`;

    const res = await model.invoke([
      { role: "system", content: "Return strict JSON only." },
      { role: "user", content: prompt },
    ]);
    const parsed = parseJsonObject<{ answer?: string }>(messageText(res.content));
    if (parsed?.answer) answer = parsed.answer;
  } catch {
    answer = state.report?.summary
      ? `From the existing report on ${state.company}:\n\n${state.report.summary}`
      : answer;
  }

  return {
    phase: "done",
    sources,
    searchBudget: budget,
    followUpBudgetRemaining: budget?.followUpRemaining ?? 0,
    activity: steps,
    messages: [new AIMessage(answer)],
  };
}
