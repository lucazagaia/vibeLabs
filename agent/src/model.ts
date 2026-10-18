import { ChatOpenAI } from "@langchain/openai";

export type ModelRole = "orchestrator" | "worker";

export const DEFAULT_ORCHESTRATOR_MODEL = "nvidia/Nemotron-3.5-Super-VL";
export const DEFAULT_WORKER_MODEL = "nvidia/Nemotron-3_5-Lightning";
export const DEFAULT_NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";

/** Orchestrator plans and writes the report. Workers extract lane findings. */
export function modelIdFor(role: ModelRole): string {
  if (role === "worker") {
    return process.env.NEBIUS_WORKER_MODEL || DEFAULT_WORKER_MODEL;
  }
  return (
    process.env.NEBIUS_ORCHESTRATOR_MODEL ||
    process.env.NEBIUS_MODEL ||
    DEFAULT_ORCHESTRATOR_MODEL
  );
}

export function getChatModel(
  role: ModelRole = "orchestrator",
  temperature = 0.2,
): ChatOpenAI {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) {
    throw new Error("NEBIUS_API_KEY is not set");
  }

  return new ChatOpenAI({
    model: modelIdFor(role),
    apiKey,
    configuration: {
      baseURL: process.env.NEBIUS_BASE_URL || DEFAULT_NEBIUS_BASE_URL,
    },
    temperature,
  });
}
