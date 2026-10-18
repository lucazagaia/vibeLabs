// The agents registered in app/api/copilotkit/[[...slug]]/route.ts (contract C3).
export const AGENTS = [
  { id: "data_buddy", label: "Data Buddy", placeholder: "Ask about the supplier data…" },
  { id: "research_buddy", label: "Research Buddy", placeholder: "Ask about a real company…" },
] as const;

export type AgentId = (typeof AGENTS)[number]["id"];

export function agentLabel(agentId: string | null): string {
  return AGENTS.find((a) => a.id === agentId)?.label ?? "Buddy";
}
