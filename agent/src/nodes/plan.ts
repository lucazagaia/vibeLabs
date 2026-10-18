import { AIMessage } from "@langchain/core/messages";
import { defaultPlan } from "./orchestrate.ts";
import type { ResearchState } from "../state.ts";
import { activity } from "../utils.ts";

export async function planNode(
  state: ResearchState,
): Promise<Partial<ResearchState>> {
  const plan = defaultPlan(state.company);
  return {
    phase: "research",
    plan,
    activity: [
      activity({
        kind: "plan",
        lane: "orchestrator",
        label: "Research plan ready",
        detail: plan.map((p) => p.title).join(" → "),
        status: "done",
      }),
    ],
    messages: [
      new AIMessage(
        `Research plan for ${state.company}:\n` +
          plan.map((p, i) => `${i + 1}. ${p.title} — ${p.detail}`).join("\n") +
          "\n\nStarting the four research lanes now.",
      ),
    ],
  };
}
