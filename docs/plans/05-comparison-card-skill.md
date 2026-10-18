# Step 5: Comparison cards as an ADK Skill (intent → tools → card)

Builds on Adham's [`comparison-card-template-spec.md`](../../comparison-card-template-spec.md), which gets moved to `docs/specs/`. It runs on the walking skeleton (Steps 1–4).

## Context
A buyer asks Data Buddy to compare suppliers, and the right comparison card appears on the dashboard. Adham's spec defines what a good card is: templates, routing, a data-shape preflight and interpretation rules.

**Decision:** implement it as an **ADK Skill** (`supplier-comparison-cards`). The skill carries a **fixed, step-by-step procedure**:
1. understand the intent
2. call the right tools
3. open the card
4. explain it

The tools do the deterministic work: routing, statistics, scales and facts. The procedure tells the model exactly when to call which tool.

## How ADK Skills work (verified in google-adk 2.12)
- **`SKILL.md`:** frontmatter (`name`, `description`, `metadata`) plus the procedure body. The model loads it with `load_skill`. In `EAGER` discovery mode the catalog sits in the system prompt, so no extra `list_skills` turn is needed.
- **`references/*.md`:** extra material that loads only when the procedure says so (`load_skill_resource`). It keeps the prompt small.
- **`metadata.adk_additional_tools: [...]`:** tools that are **only declared to the model once the skill is loaded**. Card tools can't be called outside the procedure.
- **Wiring:** `SkillToolset(skills=[...], additional_tools=[...], discovery_mode=EAGER)` goes into Data Buddy's `tools`, next to `AGUIToolset()` for the frontend tool `open_card`.
- **Status:** the feature is marked experimental in ADK. The first build sub-step is a smoke test with Nemotron + ag-ui-adk.

## File layout

```
agent/buddy/
├─ skills/supplier-comparison-cards/
│  ├─ SKILL.md                     # the procedure (below)
│  └─ references/
│     ├─ intents.md                # intent taxonomy + trigger phrases + examples
│     ├─ metric-map.md             # metric keys, synonyms, clusters, value direction (from the spec)
│     ├─ card-catalog.md           # templates and when each is used (from the spec)
│     └─ interpretation-rules.md   # how to explain a card (from the spec)
├─ cards/                          # deterministic engine behind the tools
│  ├─ registry.py                  # metric map + clusters + templates as data
│  ├─ select.py                    # supplier selection (IDs, tray, rank/filter, ≤20)
│  ├─ route.py                     # spec's "Template Selection Flow" + metric map
│  ├─ preflight.py                 # data-shape stats, flags, scale, fallbacks
│  ├─ facts.py                     # safest/riskiest, spread, quadrant outliers, hidden watchouts
│  └─ tools.py                     # the 3 skill tools (thin wrappers)
└─ data_buddy/agent.py             # + SkillToolset(EAGER) next to AGUIToolset()
agent/main.py                      # + GET /api/cards (rebuilds a card from its query spec)
web/components/cards/              # renderers (see "Frontend")
```

## The procedure (draft `SKILL.md`)

```markdown
---
name: supplier-comparison-cards
description: >
  Compare 2-20 suppliers on one or more risk, performance or exposure metrics and show the
  result as a comparison card on the dashboard. Use whenever the buyer asks to compare, rank,
  shortlist, choose between, or explain differences between suppliers.
metadata:
  adk_additional_tools: [resolve_metrics, select_suppliers, plan_card]
---

# Procedure: build a supplier comparison card

Follow these steps in order. Do not skip a step. Never state a number that did not come from a tool.

## Step 1 - Understand the intent
Classify the request into exactly one intent (see references/intents.md for trigger phrases):
- `single_metric`: one metric ("compare their financial health")
- `metric_pair`: two related metrics ("financial health vs credit rating")
- `metric_cluster`: 3-6 metrics of one topic ("ESG and workforce", "geopolitical exposure")
- `overview`: broad comparison ("compare these suppliers", "summarize them")
- `watchlist`: problems or surprises ("red flags", "why is X risky", "hidden risks")
- `exposure`: spend or contract exposure ("where is our money at risk")
- `choose`: decision ("which one should we pick", "justify the choice", "shortlist memo")
Also decide the direction: `safest` (best first) or `watch` (worst first). The default is `safest`,
but `watchlist` always means `watch`.
If the request is too vague to classify, ask ONE short clarifying question and stop.

## Step 2 - Identify the suppliers
Call `select_suppliers` with what the buyer gave you:
- explicit IDs (e.g. "SUPP_00012, SUPP_00450"): pass them as `supplier_ids`
- "these" / "my shortlist" / "the tray": pass `use_compare_tray=true`
- a criterion ("top 10 by lowest total risk", "Critical financial health"): pass `rank_by` / `filters` / `limit`
The tool returns 2-20 IDs. If it returns an error (unknown ID, fewer than 2), tell the buyer and stop.

## Step 3 - Resolve the metrics
Call `resolve_metrics` with the metric words from the request (e.g. ["financial", "credit"]).
For `overview`, `choose` and `watchlist` you may pass an empty list: the tool supplies the
default metric set for that intent. If any term is `unknown`, ask which metric was meant and stop.

## Step 4 - Plan the card
Call `plan_card(intent, direction, metrics, supplier_ids)`. It picks the template, runs the
data-shape preflight, chooses the scale and any fallback, and returns:
`card_query` (to open the card), `template`, `title`, `data_shape.notes`, and `facts`.
Do not choose a template yourself.

## Step 5 - Show the card
Call the frontend tool `open_card` with `card_query` exactly as returned. Do not change it.

## Step 6 - Explain it
Reply in 2-3 sentences using only `facts` (rules: references/interpretation-rules.md):
1. Say whether lower or higher is better for the metric(s).
2. Name the best and the worst supplier with their values from `facts`.
3. Add the most important caveat if `facts` contains one: a hidden watchout, an
   exposure-vs-risk note, "metric does not discriminate in this shortlist", or a scale note from `data_shape.notes`.
```

## The tools (deterministic Python, in `buddy/cards/tools.py`)

| Tool | Input | Output | Implements (spec section) |
|---|---|---|---|
| `resolve_metrics` | `terms: list[str]`, `intent` | `{metrics: [key…], cluster, unknown: [term…]}` | Metric names + synonyms, clusters, intent default sets |
| `select_suppliers` | `supplier_ids?`, `use_compare_tray?`, `rank_by?`, `filters?`, `limit≤20` | `{supplier_ids: [...], reason}` or `{error}` | Global assumptions (2–20 suppliers; more than 20 gets ranked down) |
| `plan_card` | `intent`, `direction`, `metrics`, `supplier_ids` | `{card_query, template, title, data_shape, facts}` | Template Selection Flow, Metric Map, Preflight, Scale Decisions, Fallback Rules, Interpretation inputs |
| `open_card` (frontend tool) | `card_query` | rendered card | — |

- **`card_query`** is a small, reproducible spec: `{intent, direction, metrics, supplier_ids, template}`. The browser calls `GET /api/cards?…` with it, and the backend rebuilds the full card deterministically.
  - **Numbers never pass through the LLM.**
  - **The card survives a reload,** because only the query spec is stored, which fits the UI-state store design.
- **`facts`** is a compact, ready-to-say summary:
  - best and worst supplier, with values
  - spread
  - quadrant outliers
  - hidden watchouts (Low or Medium total risk but a Critical geopolitical, political or environmental score; **306 such suppliers** exist in the data)
  - "not discriminating" if the values are tightly clustered

## Card contract (frozen together before the split)
The spec's "Recommended Card Data Contract", extended with:
- `intent`, `direction` and `card_query`
- `facts`, as above
- `referenceBands` for risk colours. They're fixed and identical for every score in the data: **Low 0–24, Medium 25–49, High 50–74, Critical 75–100**.
- `quadrants`: axis thresholds and labels, for scatter templates
- `scale`, which already exists in `dataShape`. **PO volume is always `log`**, because max/median is 63×.

## MVP card set (renderers on the frontend)

| # | Renderer | Covers these spec templates |
|---|---|---|
| 1 | Ranked lollipop / bar (linear or log) | `ranked_lollipop_card`, `horizontal_bar_card`, `log_exposure_bar_card` |
| 2 | Scatter with quadrants | `paired_scatter_card`, `quadrant_scatter_card`, `financial_credit_card`, `compliance_governance_card`, `performance_reliability_card`, `exposure_vs_risk_card` |
| 3 | Heatmap matrix + raw values | `risk_heatmap_matrix_card`, `overall_supplier_benchmark_card`, cluster cards (8–20 suppliers) |
| 4 | Categorical 3×3 matrix | `categorical_distribution_card`, `replaceability_complexity_card` |
| 5 | Watchlist rows | `outlier_watchlist_card`, `hidden_outlier_card` |
| 6 | Decision table | `shortlist_decision_card` |

**Later:** parallel coordinates and small-multiple radar (the spec's cluster cards for 3–6 suppliers). Until then, `route.py` falls back to the heatmap, which the spec already allows.

## Gaps in the spec, resolved here
1. `signal_share_card` and "grouped lollipop set" are referenced but never defined. They map to the heatmap (#3), or to the lollipop (#1) with several rows.
2. **Supplier selection** was missing. It's now `select_suppliers`, and more than 20 suppliers get ranked down rather than rejected.
3. **Intent and direction** were implicit. They're now explicit tool inputs.
4. **Pixel flags** (`heavy_overlap`, the 12px rule) move to the renderers, because the backend doesn't know screen positions. Data flags stay in `preflight.py`.
5. **Quadrant cut-offs:** the 0–100 risk axes split at 50 (the High band starts there). Delivery and confirmation split at the shortlist median, and the cut-off is recorded in `quadrants`.

## Work split for two people
**Together first (about 1 h):** freeze the contract, then generate **8 fixture cards from the real data**, one per renderer plus two preflight edge cases (a tight cluster and an extreme outlier).

| Person A: skill + engine (Python) | Person B: card renderers (React) |
|---|---|
| `SKILL.md` + the 4 reference files (from the spec) | Card shell: title, raw values, `dataShape` notes, interpretation slot |
| `registry`, `select`, `route`, `preflight` and `facts` | Renderers 1–6 against the fixtures |
| The 3 tools + `GET /api/cards` | Pixel overlap: deterministic jitter, label offsets, zoom inset |
| Wiring `SkillToolset` into Data Buddy | The `open_card` frontend tool + dashboard placement |
| Skill eval: about 15 prompts → expected intent, template and tool sequence | Visual check of each fixture, plus light and dark mode |

## Verification
1. **Skill smoke test (first):** with Nemotron + ag-ui-adk, the model loads the skill, and `resolve_metrics` / `select_suppliers` / `plan_card` only appear after `load_skill`.
2. **Engine unit tests:** routing for every metric in the spec's metric map, preflight flags on the fixtures, and facts checked against pandas.
3. **Skill eval:** 15 prompts (single metric, pair, cluster, overview, watchlist, exposure, choose, plus vague and unknown inputs). Each must produce the expected intent → tools → template, using an `agui_smoke`-style script.
4. **In the browser:** "Compare SUPP_00012, SUPP_00450 and SUPP_00731 on financial risk" opens the financial/credit scatter card, with a 2–3 sentence explanation that uses only numbers shown on the card.

## Execution order, with checkpoints
1. **5a:** move the spec to `docs/specs/`, run the Skill smoke test, freeze the contract, generate the fixtures. **⏸ Checkpoint.**
2. **5b (in parallel):** Person A builds the engine + skill, and Person B builds the renderers. **⏸ Checkpoint.**
3. **5c:** integration + skill eval + browser check. **⏸ Checkpoint 5.**
