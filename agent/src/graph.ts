import { END, START, StateGraph } from "@langchain/langgraph";
import { followUpNode } from "./nodes/follow-up.ts";
import { orchestrateNode } from "./nodes/orchestrate.ts";
import { planNode } from "./nodes/plan.ts";
import { redFlagDivesNode } from "./nodes/red-flag-dives.ts";
import { researchNode } from "./nodes/research.ts";
import { synthesizeNode } from "./nodes/synthesize.ts";
import { ResearchStateAnnotation, type ResearchState } from "./state.ts";

function routeAfterOrchestrate(
  state: ResearchState,
): "build_plan" | "follow_up" | typeof END {
  if (state.phase === "follow_up") return "follow_up";
  if (state.phase === "plan" || state.phase === "research") return "build_plan";
  // Waiting for a company name — end this turn.
  return END;
}

const workflow = new StateGraph(ResearchStateAnnotation)
  .addNode("orchestrate", orchestrateNode)
  .addNode("build_plan", planNode)
  .addNode("research", researchNode)
  .addNode("red_flag_dives", redFlagDivesNode)
  .addNode("synthesize", synthesizeNode)
  .addNode("follow_up", followUpNode)
  .addEdge(START, "orchestrate")
  .addConditionalEdges("orchestrate", routeAfterOrchestrate, {
    build_plan: "build_plan",
    follow_up: "follow_up",
    [END]: END,
  })
  .addEdge("build_plan", "research")
  .addEdge("research", "red_flag_dives")
  .addEdge("red_flag_dives", "synthesize")
  .addEdge("synthesize", END)
  .addEdge("follow_up", END);

/** LangGraph API server supplies persistence — do not pass a checkpointer. */
export const graph = workflow.compile();
