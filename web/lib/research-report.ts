/** Shared research report contract for the LangGraph agent and CopilotKit progress UI. */

export type ResearchLane = "financial" | "esg" | "compliance" | "news";

export type FindingSeverity = "low" | "moderate" | "high" | "unknown";

export type ActivityKind =
  | "search"
  | "reason"
  | "pivot"
  | "red_flag"
  | "plan"
  | "clarify"
  | "synthesize"
  | "follow_up";

export type ResearchSource = {
  title: string;
  url: string;
  date: string | null;
  lane: ResearchLane | "red_flag" | "follow_up";
};

export type ResearchFinding = {
  id: string;
  lane: ResearchLane;
  claim: string;
  severity: FindingSeverity;
  isRedFlag: boolean;
  eventName: string | null;
  resolved: boolean;
  sourceUrls: string[];
  documentDate: string | null;
};

export type ActivityStep = {
  id: string;
  kind: ActivityKind;
  lane?: ResearchLane | "orchestrator" | "red_flag";
  label: string;
  detail?: string;
  status: "running" | "done" | "skipped";
  at: string;
};

export type PlanStep = {
  id: string;
  lane: ResearchLane | "orchestrator" | "red_flag" | "synthesize";
  title: string;
  detail: string;
};

export type ClarifierOption = {
  id: string;
  label: string;
};

export type ClarifierQuestion = {
  id: string;
  question: string;
  options: [ClarifierOption, ClarifierOption, ClarifierOption];
};

export type LaneReportSection = {
  lane: ResearchLane;
  title: string;
  body: string;
  findingIds: string[];
};

export type ResearchReportBody = {
  summary: string;
  sections: LaneReportSection[];
  redFlagSummary: string;
};

export type ResearchAgentState = {
  company: string;
  phase:
    | "idle"
    | "clarify"
    | "plan"
    | "research"
    | "red_flags"
    | "synthesize"
    | "done"
    | "follow_up";
  clarifiers: ClarifierQuestion[];
  clarifierAnswers: Record<string, string>;
  plan: PlanStep[];
  activity: ActivityStep[];
  findings: ResearchFinding[];
  sources: ResearchSource[];
  report: ResearchReportBody | null;
  followUpBudgetRemaining: number;
  error: string | null;
};

export const LANE_TITLES: Record<ResearchLane, string> = {
  financial: "Financial health & credit",
  esg: "ESG, governance & labor",
  compliance: "Compliance, safety, quality & digital security",
  news: "News, market sentiment & geopolitical",
};

export const EMPTY_RESEARCH_STATE: ResearchAgentState = {
  company: "",
  phase: "idle",
  clarifiers: [],
  clarifierAnswers: {},
  plan: [],
  activity: [],
  findings: [],
  sources: [],
  report: null,
  followUpBudgetRemaining: 1,
  error: null,
};
