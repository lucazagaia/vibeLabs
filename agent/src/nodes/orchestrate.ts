import { AIMessage, isHumanMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";
import { getChatModel } from "../model.ts";
import type { ResearchState } from "../state.ts";
import type { ClarifierQuestion } from "../types.ts";
import {
  activity,
  extractCompanyName,
  messageText,
  parseJsonObject,
  uid,
} from "../utils.ts";

type OrchestrateDecision = {
  company: string;
  needsClarifiers: boolean;
  clarifiers: ClarifierQuestion[];
  reason: string;
};

function lastHumanText(state: ResearchState): string {
  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    const msg = state.messages[i];
    if (isHumanMessage(msg) || msg._getType?.() === "human") {
      return messageText(msg.content);
    }
  }
  return "";
}

function normalizeClarifiers(raw: ClarifierQuestion[] | undefined): ClarifierQuestion[] {
  if (!raw?.length) return [];
  return raw.slice(0, 3).map((q, i) => {
    const options = (q.options ?? []).slice(0, 3).map((o, j) => ({
      id: o.id || `opt-${i}-${j}`,
      label: o.label || `Option ${j + 1}`,
    }));
    while (options.length < 3) {
      options.push({ id: `opt-${i}-${options.length}`, label: "No preference" });
    }
    return {
      id: q.id || `q-${i + 1}`,
      question: q.question || `Clarifying question ${i + 1}`,
      options: options as ClarifierQuestion["options"],
    };
  });
}

export async function orchestrateNode(
  state: ResearchState,
): Promise<Partial<ResearchState>> {
  if (state.researched && state.report) {
    return { phase: "follow_up" };
  }

  const human = lastHumanText(state);
  const heuristicCompany = state.company || extractCompanyName(human);

  let decision: OrchestrateDecision = {
    company: heuristicCompany,
    needsClarifiers: !heuristicCompany,
    clarifiers: [],
    reason: "heuristic",
  };

  try {
    const model = getChatModel("orchestrator", 0.1);
    const prompt = `You are the orchestrator for a supplier risk deep-research agent.
Decide whether the buyer's brief is clear enough to research ONE real public company.

Buyer message:
"""${human}"""

Current company guess: "${heuristicCompany}"

Rules:
- If a real company is clearly named, needsClarifiers=false and clarifiers=[].
- If the brief is ambiguous (missing company, region, risk focus, or buyer use-case), set needsClarifiers=true and invent 1-3 clarifier questions.
- Each clarifier MUST have exactly 3 short selectable answer options.
- Never invent scores. Research happens later.

Return ONLY JSON:
{
  "company": "string",
  "needsClarifiers": boolean,
  "clarifiers": [{"id":"q1","question":"...","options":[{"id":"a","label":"..."},{"id":"b","label":"..."},{"id":"c","label":"..."}]}],
  "reason": "short"
}`;

    const res = await model.invoke([
      { role: "system", content: "Return strict JSON only." },
      { role: "user", content: prompt },
    ]);
    const parsed = parseJsonObject<OrchestrateDecision>(messageText(res.content));
    if (parsed) {
      decision = {
        company: parsed.company || heuristicCompany,
        needsClarifiers: Boolean(parsed.needsClarifiers) && !state.clarifiers.length,
        clarifiers: normalizeClarifiers(parsed.clarifiers),
        reason: parsed.reason || "model",
      };
    }
  } catch {
    // Keep heuristic decision if the model is unavailable.
  }

  if (!decision.company) {
    return {
      phase: "clarify",
      activity: [
        activity({
          kind: "clarify",
          lane: "orchestrator",
          label: "Need a company name",
          detail: "Ask the buyer to name one real public company.",
          status: "done",
        }),
      ],
      messages: [
        new AIMessage(
          "Name one real public company to research (for example: Knorr-Bremse).",
        ),
      ],
    };
  }

  const answers = { ...state.clarifierAnswers };
  let clarifiers = decision.needsClarifiers ? decision.clarifiers : [];

  // Skip clarifiers when the user already answered in prior interrupts.
  if (Object.keys(answers).length > 0) {
    clarifiers = [];
  }

  if (clarifiers.length > 0) {
    const pending = clarifiers.filter((q) => !answers[q.id]);
    for (const q of pending) {
      const picked = interrupt({
        type: "clarifier",
        questionId: q.id,
        question: q.question,
        options: q.options,
      }) as { optionId?: string; label?: string } | string;

      const optionId =
        typeof picked === "string"
          ? picked
          : picked?.optionId || picked?.label || "";
      const match = q.options.find(
        (o) => o.id === optionId || o.label === optionId,
      );
      answers[q.id] = match?.label || optionId || q.options[0].label;
    }

    return {
      company: decision.company,
      phase: "plan",
      clarifiers,
      clarifierAnswers: answers,
      activity: [
        activity({
          kind: "clarify",
          lane: "orchestrator",
          label: "Clarifiers answered",
          detail: Object.entries(answers)
            .map(([k, v]) => `${k}: ${v}`)
            .join("; "),
          status: "done",
        }),
      ],
    };
  }

  return {
    company: decision.company,
    phase: "plan",
    clarifiers: [],
    clarifierAnswers: answers,
    activity: [
      activity({
        kind: "plan",
        lane: "orchestrator",
        label: `Research ${decision.company}`,
        detail: decision.reason,
        status: "done",
      }),
    ],
  };
}

export function defaultPlan(company: string) {
  return [
    {
      id: uid("plan"),
      lane: "orchestrator" as const,
      title: "Orchestrator",
      detail: `Coordinate research for ${company} and rank red flags.`,
    },
    {
      id: uid("plan"),
      lane: "financial" as const,
      title: "Financial health & credit",
      detail: "Annual report, liquidity, credit opinions.",
    },
    {
      id: uid("plan"),
      lane: "esg" as const,
      title: "ESG, governance & labor",
      detail: "ESG report, governance, labor stability.",
    },
    {
      id: uid("plan"),
      lane: "compliance" as const,
      title: "Compliance, safety, quality & digital security",
      detail: "Lawsuits, fines, safety, recalls, breaches.",
    },
    {
      id: uid("plan"),
      lane: "news" as const,
      title: "News & geopolitical (12 months)",
      detail: "Recent news, sentiment, geopolitical exposure.",
    },
    {
      id: uid("plan"),
      lane: "red_flag" as const,
      title: "Red-flag deep dives",
      detail: "Up to three concrete unresolved events.",
    },
    {
      id: uid("plan"),
      lane: "synthesize" as const,
      title: "Risk report",
      detail: "Cited summary with lane sections.",
    },
  ];
}
