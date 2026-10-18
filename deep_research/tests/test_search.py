from datetime import datetime, timezone

import pytest

from search import (
    MAX_LANE_SEARCHES,
    SearchBudgetError,
    allowlisted_urls,
    create_search_budget,
    filter_hits_by_mode,
    is_within_news_window,
    tavily_search,
)


def test_news_window_keeps_trailing_12_months() -> None:
    now = datetime(2026, 10, 18, tzinfo=timezone.utc)
    assert is_within_news_window("2026-01-01", now) is True
    assert is_within_news_window("2025-10-19", now) is True
    assert is_within_news_window("2025-10-17", now) is False
    assert is_within_news_window(None, now) is False


def test_filing_mode_keeps_old_dates() -> None:
    now = datetime(2026, 10, 18, tzinfo=timezone.utc)
    hits = [
        {
            "title": "Old filing",
            "url": "https://example.com/ar-2023",
            "content": "annual report",
            "publishedDate": "2023-03-01",
        }
    ]
    assert len(filter_hits_by_mode(hits, "filing", now)) == 1
    assert len(filter_hits_by_mode(hits, "news", now)) == 0


def test_allowlist_drops_invented_urls() -> None:
    kept = allowlisted_urls(
        ["https://a.example", "https://invented.example", "https://a.example"],
        ["https://a.example", "https://b.example"],
    )
    assert kept == ["https://a.example"]


class _EmptySearch:
    def invoke(self, payload):
        return {"results": []}


def test_lane_search_budget_caps_at_four() -> None:
    budget = create_search_budget()
    tool = _EmptySearch()
    for index in range(MAX_LANE_SEARCHES):
        tavily_search(
            query=f"q{index}",
            mode="filing",
            budget=budget,
            budget_key="financial",
            kind="lane",
            search_tool=tool,
        )
    with pytest.raises(SearchBudgetError):
        tavily_search(
            query="overflow",
            mode="filing",
            budget=budget,
            budget_key="financial",
            kind="lane",
            search_tool=tool,
        )
    assert budget["laneSearches"]["financial"] == MAX_LANE_SEARCHES
