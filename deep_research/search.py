"""LangChain Tavily search with the same budgets as the TypeScript graph."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from langchain_tavily import TavilySearch

from models import require_env

TavilyMode = Literal["news", "filing"]
SearchKind = Literal["lane", "red_flag", "follow_up"]

MAX_LANE_SEARCHES = 4
MAX_RED_FLAG_SEARCHES = 3
MAX_FOLLOW_UP_SEARCHES = 1
NEWS_WINDOW = timedelta(days=365)


class SearchBudgetError(Exception):
    pass


def create_search_budget(follow_up_remaining: int = MAX_FOLLOW_UP_SEARCHES) -> dict[str, Any]:
    return {
        "laneSearches": {},
        "followUpRemaining": follow_up_remaining,
        "redFlagSearches": 0,
    }


def parse_published_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    text = str(raw).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def is_within_news_window(
    published_date: str | None,
    now: datetime | None = None,
) -> bool:
    published = parse_published_date(published_date)
    if published is None:
        return False
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current - published <= NEWS_WINDOW


def filter_hits_by_mode(
    hits: list[dict[str, Any]],
    mode: TavilyMode,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    if mode == "filing":
        return hits
    return [hit for hit in hits if is_within_news_window(hit.get("publishedDate"), now)]


def allowlisted_urls(claimed_urls: list[str], allowed: list[str] | set[str]) -> list[str]:
    allowed_set = set(allowed)
    seen: set[str] = set()
    kept: list[str] = []
    for url in claimed_urls:
        if url in allowed_set and url not in seen:
            seen.add(url)
            kept.append(url)
    return kept


def to_sources(hits: list[dict[str, Any]], lane: str) -> list[dict[str, Any]]:
    return [
        {
            "title": hit["title"],
            "url": hit["url"],
            "date": hit.get("publishedDate"),
            "lane": lane,
        }
        for hit in hits
    ]


def lane_search_mode(lane: str) -> TavilyMode:
    return "news" if lane == "news" else "filing"


def build_search_tool(mode: TavilyMode = "filing") -> TavilySearch:
    require_env("TAVILY_API_KEY")
    news = mode == "news"
    kwargs: dict[str, Any] = {
        "max_results": 5,
        "search_depth": "advanced",
        "topic": "news" if news else "general",
    }
    if news:
        kwargs["time_range"] = "year"
    return TavilySearch(**kwargs)


def _consume_budget(budget: dict[str, Any], kind: SearchKind, key: str) -> None:
    if kind == "lane":
        used = int(budget["laneSearches"].get(key, 0))
        if used >= MAX_LANE_SEARCHES:
            raise SearchBudgetError(f"Lane {key} already used {MAX_LANE_SEARCHES} searches")
        budget["laneSearches"][key] = used + 1
        return
    if kind == "red_flag":
        if int(budget["redFlagSearches"]) >= MAX_RED_FLAG_SEARCHES:
            raise SearchBudgetError("Red-flag search budget exhausted")
        budget["redFlagSearches"] = int(budget["redFlagSearches"]) + 1
        return
    if int(budget["followUpRemaining"]) <= 0:
        raise SearchBudgetError("Follow-up search budget exhausted")
    budget["followUpRemaining"] = int(budget["followUpRemaining"]) - 1


def hits_from_tavily_result(data: Any) -> list[dict[str, Any]]:
    parsed = data
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except json.JSONDecodeError:
            return []
    if isinstance(parsed, list):
        rows = parsed
    elif isinstance(parsed, dict):
        rows = parsed.get("results") or []
    else:
        return []

    hits: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict) or not row.get("url") or not row.get("title"):
            continue
        hits.append(
            {
                "title": row["title"],
                "url": row["url"],
                "content": row.get("content") or "",
                "publishedDate": row.get("published_date")
                or row.get("publishedDate")
                or row.get("date"),
            }
        )
    return hits


def tavily_search(
    *,
    query: str,
    mode: TavilyMode,
    budget: dict[str, Any],
    budget_key: str,
    kind: SearchKind,
    search_tool: Any | None = None,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    _consume_budget(budget, kind, budget_key)
    tool = search_tool if search_tool is not None else build_search_tool(mode)
    raw = tool.invoke({"query": query})
    return filter_hits_by_mode(hits_from_tavily_result(raw), mode, now)
