import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowlistedUrls,
  createSearchBudget,
  filterHitsByMode,
  isWithinNewsWindow,
  MAX_FOLLOW_UP_SEARCHES,
  MAX_LANE_SEARCHES,
  SearchBudgetError,
  tavilySearch,
} from "./tavily.ts";

describe("news window", () => {
  it("keeps sources within 12 months", () => {
    const now = new Date("2026-10-18T00:00:00Z");
    assert.equal(isWithinNewsWindow("2026-01-01", now), true);
    assert.equal(isWithinNewsWindow("2025-10-19", now), true);
    assert.equal(isWithinNewsWindow("2025-10-17", now), false);
    assert.equal(isWithinNewsWindow(null, now), false);
  });

  it("does not filter filing mode by date", () => {
    const now = new Date("2026-10-18T00:00:00Z");
    const hits = [
      {
        title: "Old filing",
        url: "https://example.com/ar-2023",
        content: "annual report",
        publishedDate: "2023-03-01",
      },
    ];
    assert.equal(filterHitsByMode(hits, "filing", now).length, 1);
    assert.equal(filterHitsByMode(hits, "news", now).length, 0);
  });
});

describe("url allow-list", () => {
  it("drops URLs the tool did not return", () => {
    const kept = allowlistedUrls(
      ["https://a.example", "https://invented.example", "https://a.example"],
      ["https://a.example", "https://b.example"],
    );
    assert.deepEqual(kept, ["https://a.example"]);
  });
});

const emptySearch = {
  invoke: async () => ({ results: [] }),
};

describe("search budget", () => {
  it("caps lane searches at 4", async () => {
    const budget = createSearchBudget();
    process.env.TAVILY_API_KEY = "test-key";

    for (let i = 0; i < MAX_LANE_SEARCHES; i += 1) {
      await tavilySearch({
        query: `q${i}`,
        mode: "filing",
        budget,
        budgetKey: "financial",
        kind: "lane",
        searchTool: emptySearch,
      });
    }
    await assert.rejects(
      () =>
        tavilySearch({
          query: "overflow",
          mode: "filing",
          budget,
          budgetKey: "financial",
          kind: "lane",
          searchTool: emptySearch,
        }),
      (err: unknown) => err instanceof SearchBudgetError,
    );
    assert.equal(budget.laneSearches.financial, MAX_LANE_SEARCHES);
  });

  it("caps follow-up searches at 1", async () => {
    const budget = createSearchBudget(MAX_FOLLOW_UP_SEARCHES);
    process.env.TAVILY_API_KEY = "test-key";

    await tavilySearch({
      query: "follow",
      mode: "news",
      budget,
      budgetKey: "follow_up",
      kind: "follow_up",
      searchTool: emptySearch,
    });
    await assert.rejects(
      () =>
        tavilySearch({
          query: "again",
          mode: "news",
          budget,
          budgetKey: "follow_up",
          kind: "follow_up",
          searchTool: emptySearch,
        }),
      (err: unknown) => err instanceof SearchBudgetError,
    );
    assert.equal(budget.followUpRemaining, 0);
  });
});
