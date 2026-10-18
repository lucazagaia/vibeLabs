// Contract C3: CopilotKit runtime proxying the browser to the ADK agents over AG-UI.
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { HttpAgent } from "@ag-ui/client";

// Server-only: the browser only ever talks to /api/copilotkit.
const agentBaseUrl = process.env.AGENT_BASE_URL ?? "http://localhost:8000";

const runtime = new CopilotRuntime({
  agents: {
    data_buddy: new HttpAgent({ url: `${agentBaseUrl}/data` }),
    research_buddy: new HttpAgent({ url: `${agentBaseUrl}/research` }),
  },
  runner: new InMemoryAgentRunner(),
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
