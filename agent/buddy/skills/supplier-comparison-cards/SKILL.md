---
name: supplier-comparison-cards
description: >
  Compare 2-20 suppliers on risk, performance or exposure metrics and show a comparison card on the
  dashboard. Use whenever the buyer asks to compare, rank, shortlist, choose between, or explain
  differences between suppliers.
metadata:
  adk_additional_tools:
    - compare_suppliers
---

# Procedure: build a supplier comparison card

Follow these steps in order. Never state a number that did not come from the tool result.

## Step 1 - Extract the request (fill only what the buyer actually said)

- Suppliers, one of:
  - the IDs written in the message (SUPP_ followed by 5 digits), copied exactly
  - "these", "my shortlist", "the tray": `use_compare_tray = true`
  - a criterion such as "top 10 safest by total risk": `rank_by`, `rank_order`, `limit`
  - Never make up supplier IDs.
- Mentions: for EACH separate topic the buyer mentions, add one entry to `mentions`:
  `phrase` = the buyer's words, `metrics` = every metric key that phrase could reasonably mean
  (use the metric glossary in the tool description).
  - If the phrase clearly names one metric, give exactly ONE key. Clear examples:
    "bankrupt" -> Financial_Health_Score; "credit rating" -> Credit_Rating_Score;
    "on time" -> Supplier Delivery Rating; "changing our orders" -> Order Change Rate;
    "overall" -> Total_Risk_Index; "hacking" -> Digital_Security_Score;
    "spend" -> Purchase Order Volume (EUR); "sub-suppliers" -> Sub_Tier_Visibility_Score.
  - If it is a broad concept that could mean several metrics, list ALL candidates and do not pick
    one yourself (the buyer will be asked). Broad examples: "financial risk" ->
    [Financial_Health_Score, Credit_Rating_Score]; "reputation" -> [Media_Sentiment_Score,
    Market_Sentiment_Score, External_Intelligence_Score, Industry_Benchmark_Score];
    "legal problems" -> [Compliance_Risk_Score, Governance_Risk_Score].
  - If the buyer asks about any specific topic, `mentions` must not be empty. Leave it empty only
    for fully general requests ("compare these suppliers", "which should we pick").
  - Unsure what a metric means? Load references/metric-map.md.
- Intent, exactly one:
  - `choose`: which one to pick, justify a choice, shortlist memo
  - `watchlist`: red flags, why is X risky, hidden risks, surprises
  - `exposure`: spend, contract exposure, where our money is at risk
  - `overview`: compare them in general, summarize, overall comparison
  - `compare`: anything else that names a topic (the default)
- Direction: `watch` if the buyer asks for the worst, riskiest or problems; otherwise `safest`.

## Step 2 - Call the tool once

Call `compare_suppliers` with the extracted fields and `request` = the buyer's message, copied
exactly, character for character.

## Step 3 - Reply based on `status`

- `ok`: the card is already on the dashboard. Reply with `summary` (you may shorten it, but never
  add a number that is not in `summary`). Stop.
- `needs_clarification`: ask `question` and list `options` exactly as given. Stop. When the buyer
  picks an option, call `compare_suppliers` again with the same fields, but replace that mention's
  `metrics` with the single chosen key.
- `error`: tell the buyer `message` in one sentence. Stop.
