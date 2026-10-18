import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  downgradeResolvedFinding,
  looksResolved,
  rankRedFlags,
} from "./red-flags.ts";
import type { ResearchFinding } from "./types.ts";

function finding(
  partial: Partial<ResearchFinding> & Pick<ResearchFinding, "id" | "claim">,
): ResearchFinding {
  return {
    lane: "compliance",
    severity: "high",
    isRedFlag: true,
    eventName: "Case X",
    resolved: false,
    sourceUrls: ["https://example.com/1"],
    documentDate: null,
    ...partial,
  };
}

describe("rankRedFlags", () => {
  it("keeps only high unresolved concrete events, max 3", () => {
    const ranked = rankRedFlags([
      finding({ id: "1", claim: "a", eventName: "Lawsuit A", sourceUrls: ["a", "b"] }),
      finding({ id: "2", claim: "b", severity: "moderate", eventName: "Fine B" }),
      finding({ id: "3", claim: "c", isRedFlag: false, eventName: "Noise" }),
      finding({ id: "4", claim: "d", eventName: null }),
      finding({ id: "5", claim: "e", eventName: "Strike E", sourceUrls: ["e"] }),
      finding({ id: "6", claim: "f", eventName: "Breach F", sourceUrls: ["f"] }),
      finding({ id: "7", claim: "g", eventName: "Recall G", sourceUrls: ["g"] }),
    ]);
    assert.equal(ranked.length, 3);
    assert.equal(ranked[0].id, "1");
    assert.deepEqual(
      ranked.map((r) => r.id),
      ["1", "5", "6"],
    );
  });
});

describe("downgradeResolvedFinding", () => {
  it("marks resolved and drops severity from high to moderate", () => {
    const updated = downgradeResolvedFinding(
      finding({ id: "1", claim: "Open lawsuit." }),
      ["https://example.com/resolution"],
    );
    assert.equal(updated.resolved, true);
    assert.equal(updated.severity, "moderate");
    assert.ok(updated.sourceUrls.includes("https://example.com/resolution"));
    assert.match(updated.claim, /resolved/i);
  });
});

describe("looksResolved", () => {
  it("detects resolution language and rejects ongoing language", () => {
    assert.equal(looksResolved("The case was settled in 2025."), true);
    assert.equal(looksResolved("The investigation is still ongoing."), false);
  });
});
