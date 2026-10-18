"use client";

import { useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

import { useDashboard } from "./DashboardContext";

// Contract C4: the browser half of `show_notice`. Registered once, so both agents can call it
// (each declares AGUIToolset() on the backend).
export function ShowNoticeTool() {
  const { addNotice } = useDashboard();

  useFrontendTool(
    {
      name: "show_notice",
      description: "Show a short notice card on the dashboard.",
      parameters: z.object({
        text: z.string().describe("The notice text"),
      }),
      handler: async ({ text }, context) => {
        addNotice(text, context?.agent?.agentId ?? null);
        return "Notice shown";
      },
    },
    [addNotice],
  );

  return null;
}
