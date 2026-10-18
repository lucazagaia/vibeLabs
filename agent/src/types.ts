export type ResearchLane =
  | "financial"
  | "esg"
  | "compliance"
  | "news";

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

export const LANE_TITLES: Record<ResearchLane, string> = {
  financial: "Financial health & credit",
  esg: "ESG, governance & labor",
  compliance: "Compliance, safety, quality & digital security",
  news: "News, market sentiment & geopolitical",
};

export const ALL_LANES: ResearchLane[] = [
  "financial",
  "esg",
  "compliance",
  "news",
];

export const LANE_FOCUS: Record<ResearchLane, string> = {
  financial:
    "Financial health, liquidity, bankruptcy risk, creditworthiness, and current annual report or credit opinions.",
  esg: "ESG performance, governance, ethics, labor stability, strikes, and current ESG or sustainability reports.",
  compliance:
    "Lawsuits, regulatory fines, safety incidents, product recalls, quality failures, and digital security breaches.",
  news: "News, media and market sentiment, and geopolitical or political exposure within the last 12 months.",
};
