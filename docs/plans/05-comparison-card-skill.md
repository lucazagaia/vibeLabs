# Step 5: Comparison cards as an ADK Skill (agent extracts, code decides)

Builds on Adham's [`comparison-card-template-spec.md`](../specs/comparison-card-template-spec.md). It runs on the walking skeleton (Steps 1–4). The frozen contract is in [`docs/specs/card-contract.md`](../specs/card-contract.md).

## Context
A buyer asks Data Buddy to compare suppliers, and the right comparison card appears on the dashboard. Adham's spec defines what a good card is: templates, routing, a data-shape preflight and interpretation rules.

**Decision:** an **ADK Skill** (`supplier-comparison-cards`) with a fixed procedure and a clear division of labour:
- **The agent understands the request.** It extracts suppliers, metrics, intent and direction into **enum-constrained tool arguments**. Language understanding is the model's strength.
- **Code decides everything else.** It validates, selects suppliers, picks the template, runs the preflight, works out the facts and writes the summary. The card renders from the tool result.

## How ADK Skills work (verified in google-adk 2.12)
- **`SKILL.md`:** frontmatter (`name`, `description`, `metadata`) plus the procedure body. The model loads it with `load_skill`. `EAGER` discovery puts the catalog in the system prompt, so no `list_skills` turn is needed.
- **`references/*.md`:** loaded only when the procedure says so (`load_skill_resource`).
- **`metadata.adk_additional_tools: [...]`:** the skill's tools are **only declared to the model once the skill is loaded**.
- **Lifecycle:** a loaded skill stays active for the rest of the session by default.
- **Wiring:** `SkillToolset(skills=[...], additional_tools=[...], discovery_mode=EAGER)` goes into Data Buddy's `tools`.
- **Status:** the feature is marked experimental in ADK. The first build sub-step is a smoke test with Nemotron + ag-ui-adk.

## Who decides what

| Step | Decided by | How |
|---|---|---|
| Recognise a comparison request | **Agent** | The skill description in the system prompt (`EAGER`) |
| Extract metric *mentions*, intent and direction | **Agent** | For each topic the buyer mentions, one `{phrase, metrics: [candidate keys]}` entry. The tool description includes a one-line glossary per metric. Enums: the 25 metric keys, 5 intents, 2 directions |
| Is a mention ambiguous? | **Code** | Any mention with more than one candidate becomes `needs_clarification`, and **the buyer chooses one** option. `compare` with no mentions also gets a question |
| Supplier IDs | **Code** | Regex `SUPP_\d{5}` on the verbatim `request`. The model's `supplier_ids` are only accepted if they appear there |
| Validate and normalise the arguments | **Code** | Unknown values or missing suppliers become `needs_clarification`. The metric count decides single/pair/cluster, never the agent |
| Select 2–20 suppliers | **Code** | Explicit IDs, the compare tray (from session state), or ranking criteria |
| Template, preflight, scale, fallback | **Code** | The spec's selection flow + metric map + preflight rules |
| Facts + 2–3 sentence summary | **Code** | Facts, then a sentence template per card type |
| Show the card | **Code** | Frontend renders it from the tool result (`useRenderTool`; the docs confirm a backend tool can be rendered with no client handler) |
| Reply to the buyer | **Agent** | Relays `summary`, or the clarifying question |

**Model turns:** `load_skill` (first use in a session only) → `compare_suppliers` → reply. That's 3 turns the first time and **2 after that**.

### Evidence (tested 18 Oct on Lightning, reasoning `none`, with this schema)
**Metric mapping, 34 natural-language requests:**

| Variant | Correct | Invented IDs |
|---|---|---|
| Bare enum of 25 keys | 17/34 | 0 |
| + per-metric glossary | 30/34 | 12 |
| + targeted rules (fewest metrics, "overall" → Total Risk Index, IDs only if written) | **34/34** | **0** |

The glossary is essential, and so are the explicit rules.

**Ambiguity (16 requests: 6 vague concepts, 10 clear or explicit lists), using nested `mentions`:**
- The ask decision was correct in **13/16 and 15/16** runs.
- **0 vague concepts slipped through without a question** (no wrong cards).
- The only errors were unnecessary questions on clear requests, for example "on time" read as delivery *or* confirmation. More clear-term examples reduce these.
- **Schema finding:** a flat `metrics` field plus a separate "ambiguous" field did worse (8–10/16). The model then picks a metric itself instead of flagging the ambiguity. Nested `mentions` makes it list the candidates.

**Reasoning budget:** at `low`, a 512-token cap ran out before the arguments were written (`finish_reason=length`). With 2048 tokens it scored 34/34. Any agent with reasoning on gets a cap of at least 2048 tokens.

**Effect:**
- The model handles varied language: "least likely to go bankrupt" → `Financial_Health_Score`.
- **There's no parser or synonym table to build.**
- Everything after extraction is repeatable and unit-testable without an LLM.
- The card can't be altered by the model.

## The procedure (draft `SKILL.md`)

```markdown
---
name: supplier-comparison-cards
description: >
  Compare 2-20 suppliers on risk, performance or exposure metrics and show a comparison card on
  the dashboard. Use whenever the buyer asks to compare, rank, shortlist, choose between, or
  explain differences between suppliers.
metadata:
  adk_additional_tools: [compare_suppliers]
---

# Procedure: build a supplier comparison card

## Step 1 - Extract the request (fill only what the buyer actually said)
- Suppliers, one of:
  - the IDs written in the message (SUPP_ followed by 5 digits), copied exactly
  - "these", "my shortlist", "the tray": `use_compare_tray = true`
  - a criterion such as "top 10 safest by total risk": `rank_by`, `rank_order`, `limit`
- Mentions: for EACH separate topic the buyer mentions, add one entry to `mentions`:
  `phrase` = the buyer's words, `metrics` = every metric key that phrase could reasonably mean
  (use the metric glossary in the tool description).
  - If the phrase clearly names one metric, give exactly ONE key. Clear examples: "bankrupt" ->
    Financial_Health_Score; "credit rating" -> Credit_Rating_Score; "on time" -> Supplier Delivery
    Rating; "changing our orders" -> Order Change Rate; "overall" -> Total_Risk_Index;
    "hacking" -> Digital_Security_Score; "spend" -> Purchase Order Volume (EUR).
  - If it is a broad concept that could mean several metrics, list ALL candidates and do not pick
    one yourself (the buyer will be asked). Broad examples: "financial risk" -> [Financial_Health_Score,
    Credit_Rating_Score]; "reputation" -> [Media_Sentiment_Score, Market_Sentiment_Score,
    External_Intelligence_Score, Industry_Benchmark_Score]; "legal problems" -> [Compliance_Risk_Score,
    Governance_Risk_Score].
  - If the buyer asks about any specific topic, `mentions` must not be empty. Leave it empty only for
    fully general requests ("compare these suppliers", "which should we pick").
- Intent, exactly one:
  - `choose`: which one to pick, justify a choice, shortlist memo
  - `watchlist`: red flags, why is X risky, hidden risks, surprises
  - `exposure`: spend, contract exposure, where our money is at risk
  - `overview`: compare them in general, summarize, overall
  - `compare`: anything else that names metrics (the default)
- Direction: `watch` if the buyer asks for the worst, riskiest or problems; otherwise `safest`.
Never invent supplier IDs or metrics that the buyer did not mention.

## Step 2 - Call the tool once
Call `compare_suppliers` with the extracted fields and `request` = the buyer's message verbatim.

## Step 3 - Reply based on `status`
- `ok`: the card is already on the dashboard. Reply with `summary` (you may shorten it, but never
  add a number that is not in `summary`). Stop.
- `needs_clarification`: ask `question` and list `options` exactly as given. Stop. When the buyer
  picks an option, call `compare_suppliers` again with the same fields, but replace that mention's
  `metrics` with the single chosen key.
- `error`: tell the buyer `message` in one sentence. Stop.
```

## The tool (`buddy/cards/`)

```python
compare_suppliers(
    request: str,                                  # verbatim, for logging and evals
    intent: Literal["compare", "overview", "watchlist", "exposure", "choose"],
    direction: Literal["safest", "watch"],
    mentions: list[Mention] = [],                  # Mention = {phrase: str, metrics: list[MetricKey]}
                                                   # MetricKey = Literal of the 25 spec metric keys
    supplier_ids: list[str] = [],                  # kept only if the ID appears in `request` (code-enforced)
    use_compare_tray: bool = False,
    rank_by: MetricKey | None = None,
    rank_order: Literal["lowest", "highest"] | None = None,
    limit: int | None = None,                      # 2-20
) -> {"status": "ok" | "needs_clarification" | "error", "card"?, "summary"?, "question"?, "options"?, "message"?}
```

This is the pipeline, all deterministic:
1. **`validate.py`:**
   - **Enum values:** reject unknown ones. The schema allows only valid values, but check anyway.
   - **Supplier IDs:** extracted with the regex `SUPP_\d{5}` from the verbatim `request`. Any model-supplied ID that isn't in the request is dropped, because without that rule the model invented IDs for "these suppliers" in tests.
   - **Ambiguity → the buyer chooses one:** if a mention has more than one candidate, return `needs_clarification`. For example: `question`: "'financial risk' can mean several things. Which one should I compare?", `options`: ["Financial health (liquidity, bankruptcy risk)", "Credit rating"]. The option labels come from the metric glossary.
   - **No mentions with `intent = compare`** → `overview`: the spec's overall benchmark card for general comparisons. A question here caused needless asking in 5a.
   - **Explicit lists aren't ambiguous:** if every candidate's own name appears in the request ("financial health *and* credit rating"), the buyer listed them, so there's no question. This is implemented in `validate.py` (`needs_choice`).
   - **Suppliers:** unknown IDs, or no suppliers at all → `needs_clarification`, with options such as "use the compare tray" or "top 10 by total risk".
   - **Normalise `compare`:** decided purely by the metrics.
     - 1 metric → the spec's single-metric default. For example, Financial Health on its own becomes the **financial/credit scatter**.
     - 2 metrics that form a spec pair → the pair card.
     - 3–6 metrics in one cluster → the cluster card.
     - Mixed metrics → `overview`.
   - **Empty `metrics`:** filled from the intent's default set (overview, watchlist, exposure, choose).
2. **`select.py`:** 2–20 suppliers. More than 20 get ranked down by the requested metric or total risk; fewer than 2 is an `error`.
3. **`route.py`:** the spec's Template Selection Flow + Metric Map, and that template → renderer.
4. **`preflight.py`:** the spec's data-level statistics and flags, the scale decision and the fallbacks. PO volume is always on a log scale (max/median is 63×).
5. **`facts.py` + `summary.py`:**
   - best and worst supplier, spread, quadrant outliers
   - hidden watchouts: Low or Medium total risk but a Critical geopolitical, political or environmental score (306 in the data)
   - then a 2–3 sentence `summary` from a template per card type
6. **Return** `{status: "ok", card, summary}`. The frontend renders `card` from the tool result.

## Card contract (frozen together before the split)
The spec's "Recommended Card Data Contract", plus:
- `renderer`: `rank`, `scatter` or `table` (see below)
- `intent`, `direction` and `facts`
- `referenceBands`: **Low 0–24, Medium 25–49, High 50–74, Critical 75–100**. These are identical for every score in the data.
- `quadrants`: thresholds and labels. Risk axes split at 50 (where the High band starts), and delivery/confirmation split at the shortlist median.

## MVP: the simplest renderer set that still matches the spec

Every spec template is a **config of one of three renderers**:

| Renderer | Spec templates it renders | Match with the spec |
|---|---|---|
| **`rank`**: one sorted axis per metric (lollipop/bar, linear or log). Several metrics give stacked lanes, one per metric | `ranked_lollipop_card`, `horizontal_bar_card`, `log_exposure_bar_card`; **cluster cards** `esg_workforce_card`, `reputation_cluster_card`, `geopolitical_external_card` as a *grouped lollipop set* | ✅ The spec's default for every single-metric lollipop/bar, and its primary option for the cluster cards |
| **`scatter`**: two axes with quadrants, optional dot size | `paired_scatter_card`, `quadrant_scatter_card`, `financial_credit_card`, `compliance_governance_card`, `performance_reliability_card`, `exposure_vs_risk_card` | ✅ The spec's default for all eight "paired" metrics and every combined two-axis card |
| **`table`**: rows × columns, with colour-banded cells, raw values and optional row flags or text sections | `risk_heatmap_matrix_card`, `overall_supplier_benchmark_card`, `grouped_metric_table_card`, `categorical_distribution_card`, `replaceability_complexity_card` (3×3 grid), `outlier_watchlist_card`, `hidden_outlier_card`, `shortlist_decision_card`, `operational_chain_card` (spec: "or grouped heatmap") | ✅ The spec's default for these, and its stated fallback of choice ("A clear table is better than a clever but distorted chart") |

**Deferred:** `parallel_coordinates_card` and `category_profile_radar_card`. Until they exist, `route.py` uses the spec's own fallbacks: grouped bars (`rank`) or the heatmap (`table`).

**Why 3 and not fewer:**
- Dropping `scatter` would break the spec's default for eight metrics.
- Dropping `rank` would force a table for single-metric questions, which are the most common.

## File layout

```
agent/buddy/
├─ skills/supplier-comparison-cards/
│  ├─ SKILL.md
│  └─ references/
│     ├─ metric-map.md         # the 25 metric keys with synonyms, clusters, direction (the one-line glossary
│     │                        #  is ALSO in the tool description: tests showed it's needed on every call)
│     └─ card-catalog.md       # template → renderer, defaults, fallbacks (from the spec)
├─ cards/  schema.py · validate.py · select.py · route.py · preflight.py · facts.py · summary.py · tool.py
└─ data_buddy/agent.py        # + SkillToolset(skills=[...], additional_tools=[compare_suppliers], EAGER)
web/components/cards/          # RankCard, ScatterCard, TableCard, CardShell
                               # + useRenderTool("compare_suppliers") → puts the card on the dashboard
```

## Work split for two people
**Together first (about 1 h):**
- Freeze the contract and the tool schema.
- Generate **8 fixture cards from the real data**: 2 per renderer, plus a tight cluster and an extreme outlier.
- *(Done in 5a:)* a **12-case quick eval**, `agent/evals/quick_eval.json`. It's deliberately small because of hackathon time.

| Person A: skill + engine (Python) | Person B: renderers (React) |
|---|---|
| `SKILL.md` + references (from the spec) | `CardShell`: title, raw values, `dataShape` notes, summary |
| `schema` (enums) → `validate` → `select` → `route` → `preflight` → `facts` → `summary` | `RankCard`, `ScatterCard`, `TableCard` against the fixtures |
| `compare_suppliers` tool + `SkillToolset` wiring | Pixel overlap: deterministic jitter, label offsets, zoom inset |
| Unit tests for validation + routing (every metric in the spec map) | `useRenderTool("compare_suppliers")` → dashboard placement |

## Verification
1. **Skill smoke test (first):**
   - With Nemotron + ag-ui-adk, the skill loads, and `compare_suppliers` appears only after `load_skill`.
   - The tool's JSON schema lists the enums (the `Literal` types become `enum`).
2. **No LLM needed:** unit tests for validation, normalisation and routing for every metric in the spec map. Facts are checked against pandas.
3. **Quick eval, run once before the demo:** `uv run python scripts/skill_smoke.py --quick-eval`, 12 cases. Must hold:
   - the ask-or-not decision is right in all 12
   - no invented supplier IDs
   - (the 5a result was 12/12 on asking, and 10/12 with the exact metric; the other 2 fell back to the overview card)
4. **In the browser:** "Which of SUPP_00012, SUPP_00450 and SUPP_00731 is least likely to go bankrupt?" renders the financial/credit scatter from the tool result, and the reply matches `summary`.

## Execution order, with checkpoints
1. **5a:**
   - move the spec to `docs/specs/`
   - run the Skill smoke test, including the enum schema check
   - freeze the contract and the tool schema
   - write the fixtures and the quick eval

   **⏸ Checkpoint.**
2. **5b (in parallel):** Person A builds the engine + skill, and Person B builds the 3 renderers. **⏸ Checkpoint.**
3. **5c:** integration + quick eval + browser check. **⏸ Checkpoint 5.**
