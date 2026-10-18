import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

export const runtime = "nodejs";
export const maxDuration = 300;

const copilotRuntime = new CopilotRuntime({
  agents: {
    research_agent: new LangGraphAgent({
      deploymentUrl:
        process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
      graphId: "research_agent",
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
  },
});

const handler = createCopilotRuntimeHandler({
  runtime: copilotRuntime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
