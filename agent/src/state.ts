import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type {
  ActivityStep,
  ClarifierQuestion,
  PlanStep,
  ResearchFinding,
  ResearchReportBody,
  ResearchSource,
} from "./types.ts";
import type { SearchBudget } from "./tavily.ts";
import { createSearchBudget } from "./tavily.ts";

export const ResearchStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  company: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  phase: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "idle",
  }),
  clarifiers: Annotation<ClarifierQuestion[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  clarifierAnswers: Annotation<Record<string, string>>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  plan: Annotation<PlanStep[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  activity: Annotation<ActivityStep[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  findings: Annotation<ResearchFinding[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  sources: Annotation<ResearchSource[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  report: Annotation<ResearchReportBody | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  followUpBudgetRemaining: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 1,
  }),
  searchBudget: Annotation<SearchBudget>({
    reducer: (_left, right) => right,
    default: () => createSearchBudget(1),
  }),
  error: Annotation<string | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  researched: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
});

export type ResearchState = typeof ResearchStateAnnotation.State;
