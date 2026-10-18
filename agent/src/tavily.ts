import { TavilySearchAPIWrapper } from "@langchain/tavily";
import type { ResearchLane, ResearchSource } from "./types.ts";

export type TavilySearchTool = {
  invoke: (input: {
    query: string;
    topic?: "general" | "news" | "finance";
    timeRange?: "day" | "week" | "month" | "year";
    searchDepth?: "basic" | "advanced";
  }) => Promise<unknown>;
};

export type TavilyMode = "news" | "filing";

export type TavilyHit = {
  title: string;
  url: string;
  content: string;
  publishedDate: string | null;
};

export type SearchBudget = {
  laneSearches: Record<string, number>;
  followUpRemaining: number;
  redFlagSearches: number;
};

export const MAX_LANE_SEARCHES = 4;
export const MAX_RED_FLAG_SEARCHES = 3;
export const MAX_FOLLOW_UP_SEARCHES = 1;
export const NEWS_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export function createSearchBudget(
  followUpRemaining = MAX_FOLLOW_UP_SEARCHES,
): SearchBudget {
  return {
    laneSearches: {},
    followUpRemaining,
    redFlagSearches: 0,
  };
}

export function parsePublishedDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isWithinNewsWindow(
  publishedDate: string | null | undefined,
  now = new Date(),
): boolean {
  const d = parsePublishedDate(publishedDate);
  if (!d) return false;
  return now.getTime() - d.getTime() <= NEWS_WINDOW_MS;
}

export function filterHitsByMode(
  hits: TavilyHit[],
  mode: TavilyMode,
  now = new Date(),
): TavilyHit[] {
  if (mode === "filing") return hits;
  return hits.filter((h) => isWithinNewsWindow(h.publishedDate, now));
}

export function allowlistedUrls(
  claimedUrls: string[],
  allowed: Iterable<string>,
): string[] {
  const set = new Set(allowed);
  return [...new Set(claimedUrls.filter((u) => set.has(u)))];
}

export function toSources(
  hits: TavilyHit[],
  lane: ResearchSource["lane"],
): ResearchSource[] {
  return hits.map((h) => ({
    title: h.title,
    url: h.url,
    date: h.publishedDate,
    lane,
  }));
}

type SearchArgs = {
  query: string;
  mode: TavilyMode;
  budget: SearchBudget;
  budgetKey: string;
  kind: "lane" | "red_flag" | "follow_up";
  maxResults?: number;
  searchTool?: TavilySearchTool;
};

export class SearchBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchBudgetError";
  }
}

function consumeBudget(budget: SearchBudget, kind: SearchArgs["kind"], key: string) {
  if (kind === "lane") {
    const used = budget.laneSearches[key] ?? 0;
    if (used >= MAX_LANE_SEARCHES) {
      throw new SearchBudgetError(
        `Lane ${key} already used ${MAX_LANE_SEARCHES} searches`,
      );
    }
    budget.laneSearches[key] = used + 1;
    return;
  }
  if (kind === "red_flag") {
    if (budget.redFlagSearches >= MAX_RED_FLAG_SEARCHES) {
      throw new SearchBudgetError("Red-flag search budget exhausted");
    }
    budget.redFlagSearches += 1;
    return;
  }
  if (budget.followUpRemaining <= 0) {
    throw new SearchBudgetError("Follow-up search budget exhausted");
  }
  budget.followUpRemaining -= 1;
}

/**
 * Searches are fixed pipeline steps, not model tool calls, so they hit the Tavily API directly.
 * Running the `TavilySearch` tool inside a node emits `on_tool_end` without a tool_call_id, which
 * the AG-UI LangGraph adapter turns into invalid TOOL_CALL_* events that abort the chat run.
 */
function createSearchTool(args: SearchArgs): TavilySearchTool {
  const api = new TavilySearchAPIWrapper({});
  return {
    invoke: (input) =>
      api.rawResults({ ...input, maxResults: args.maxResults ?? 5 }),
  };
}

export function hitsFromTavilyResult(data: unknown): TavilyHit[] {
  let parsed = data;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "results" in parsed
      ? ((parsed as { results?: unknown[] }).results ?? [])
      : [];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const hit = row as {
      title?: string;
      url?: string;
      content?: string;
      published_date?: string | null;
      publishedDate?: string | null;
    };
    if (!hit.url || !hit.title) return [];
    return [
      {
        title: hit.title,
        url: hit.url,
        content: hit.content ?? "",
        publishedDate: hit.published_date ?? hit.publishedDate ?? null,
      },
    ];
  });
}

export async function tavilySearch(args: SearchArgs): Promise<TavilyHit[]> {
  consumeBudget(args.budget, args.kind, args.budgetKey);

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set");
  }

  const tool = args.searchTool ?? createSearchTool(args);
  const news = args.mode === "news";
  const data = await tool.invoke({
    query: args.query,
    topic: news ? "news" : "general",
    searchDepth: "advanced",
    ...(news ? { timeRange: "year" as const } : {}),
  });

  return filterHitsByMode(hitsFromTavilyResult(data), args.mode);
}

export function laneSearchMode(lane: ResearchLane): TavilyMode {
  return lane === "news" ? "news" : "filing";
}
