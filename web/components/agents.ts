// The agents registered in app/api/copilotkit/[[...slug]]/route.ts (contract C3).
export const AGENTS = [
  {
    id: "data_buddy",
    label: "Data Buddy",
    placeholder: "Ask about the supplier data…",
    welcome: "Hi, I'm Data Buddy.",
  },
  {
    id: "research_buddy",
    label: "Research Buddy",
    placeholder: "Research a real company for supplier risk…",
    welcome: "Hi, I'm Research Buddy. Name a real public company to research",
  },
] as const;

export type AgentId = (typeof AGENTS)[number]["id"];

export function agentLabel(agentId: string | null): string {
  return AGENTS.find((a) => a.id === agentId)?.label ?? "Buddy";
}
