// CopilotKit runtime: Data Buddy via ADK (AG-UI), Research Buddy via LangGraph deep research.
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { HttpAgent } from "@ag-ui/client";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

// Server-only: the browser only ever talks to /api/copilotkit.
const agentBaseUrl = process.env.AGENT_BASE_URL ?? "http://localhost:8000";
const langGraphUrl =
  process.env.LANGGRAPH_DEPLOYMENT_URL ?? "http://localhost:8123";

const copilotRuntime = new CopilotRuntime({
  agents: {
    data_buddy: new HttpAgent({ url: `${agentBaseUrl}/data` }),
    research_buddy: new LangGraphAgent({
      deploymentUrl: langGraphUrl,
      graphId: "research_agent",
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
  },
  runner: new InMemoryAgentRunner(),
});

const handler = createCopilotRuntimeHandler({
  runtime: copilotRuntime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
