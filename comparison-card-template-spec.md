# Supplier Comparison Card Template Spec

This document defines reusable comparison-card templates for supplier metrics in `Siemens.csv` from the repo. It is intended for a UI harness that receives a buyer request, detects which metric or metric group is being compared, chooses the best card template, populates it with up to 20 suppliers, and renders the result.

The goal is not to prescribe exact visual styling. The goal is to define the comparison logic, chart type, required inputs, derived values, and when each card should be selected.

## Global Assumptions

- Compare between 2 and 20 suppliers per card.
- Risk scores use `0 = lowest risk` and `100 = highest risk`.
- Performance metrics such as delivery and confirmation use `higher = better`.
- `Purchase Order Volume (EUR)` is exposure/materiality, not risk.
- When a metric has a corresponding `_Level` column, use it as contextual labeling, not as the primary comparison value.
- Every card should include supplier ID, supplier name, raw metric values, and a short generated interpretation.
- If more than 20 suppliers are passed, the harness should require filtering or ranking before rendering.

## Template Selection Flow

1. Normalize the user query into metric keys.
2. If exactly one numeric metric is requested, use its default single-metric card.
3. If two strongly related metrics are requested, prefer the paired-metric card over two separate cards.
4. If three to six related metrics are requested, use a profile or grouped matrix card.
5. If the request asks for "overall", "best", "top", "shortlist", or "compare suppliers generally", use the `overall_supplier_benchmark_card`.
6. If the request mixes risk and operational/exposure metrics, use a mixed decision card rather than forcing everything into one chart.

## Data Shape Preflight

Before rendering any chart card, the harness should inspect the selected supplier values and decide whether the default card will remain readable. This preflight happens after metric routing but before final template rendering.

### Required Preflight Statistics

For every numeric metric in the selected card, compute:

- `min`, `max`, `range`
- `mean`, `median`
- `q1`, `q3`, `iqr`
- `standardDeviation`
- `uniqueValueCount`
- `duplicateValueGroups`
- `outlierCount` using the IQR rule: values below `q1 - 1.5 * iqr` or above `q3 + 1.5 * iqr`
- `rangeToIqrRatio = range / max(iqr, 1)`
- `maxToMedianRatio = max / max(median, 1)` for positive-only metrics such as PO volume
- `normalizedSpacing` between adjacent sorted values on the proposed chart scale

For paired charts, also compute:

- number of points with identical or near-identical `(x, y)` positions
- minimum screen-space distance between points after scaling
- quadrant counts
- correlation between the two metrics for the selected suppliers

For multi-axis profile charts such as radar or parallel coordinates, also compute:

- per-supplier profile magnitude, such as average or max score across the selected axes
- profile spread between the smallest and largest supplier profile
- per-axis variance
- number of suppliers whose polygons/lines would overlap heavily

### Shape Flags

The harness should attach these flags to the chosen card plan:

| Flag | Trigger | Why It Matters | Preferred Response |
|---|---|---|---|
| `tight_cluster` | `range <= 8` for 0-100 scores, or values differ by less than 10% of chart width | Dots/bars appear nearly identical | Use rank labels, zoomed domain, or a table-enhanced card |
| `heavy_overlap` | two or more points map within 12px of each other | Dots sit on top of each other | Add jitter, beeswarm offsets, labels, or aggregate duplicate points |
| `extreme_outlier` | any outlier by IQR rule, or `rangeToIqrRatio > 4` | One supplier stretches the axis and compresses everyone else | Use broken-axis, log scale, winsorized visual scale, or split outlier callout |
| `skewed_positive` | `maxToMedianRatio > 5` | Linear scale becomes misleading | Use log scale or exposure buckets |
| `low_variance_metric` | `uniqueValueCount <= 3` or `range <= 5` | Chart has little discriminating value | Prefer categorical/table card with note that suppliers are similar |
| `radar_dominance` | largest profile magnitude is more than 2.5x smallest profile magnitude | Small profiles become unreadable inside large polygons | Avoid multi-supplier radar; use small multiples or grouped bars |
| `too_many_profiles` | radar requested with more than 6 suppliers | Radar becomes unreadable | Use parallel coordinates, heatmap, or supplier profile small multiples |
| `mixed_scale_metrics` | combined metrics use very different units or distributions | One axis dominates the visual | Normalize to percentile/z-score or use separated panels |

### Scale Decisions

The harness should choose a scale before drawing the card.

| Data Shape | Recommended Scale | Notes |
|---|---|---|
| Normal 0-100 risk scores | Fixed `0-100` domain | Best for comparability across cards |
| Tight cluster on 0-100 score | Zoomed domain with padding plus visible `0-100` reference marker | Use only if the card clearly says the axis is zoomed |
| Extreme outlier on 0-100 score | Fixed `0-100` plus outlier callout, or split into "cluster" and "outlier" rows | Avoid hiding the outlier by over-zooming |
| Positive skewed currency/exposure | Log scale | Required for PO volume unless selected suppliers have a narrow range |
| Duplicate or near-duplicate scatter points | Jittered/beeswarm point placement | Keep raw values in tooltip/table so jitter is not mistaken for data |
| Mixed metrics in one card | Percentile normalization or separate aligned panels | Do not plot EUR, percentages, and risk scores on one raw axis |

### Fallback Rules

- If `ranked_lollipop_card` has `tight_cluster`, keep the ranking but add numeric labels and a small `spread` annotation. If the spread is extremely small, use `grouped_metric_table_card` instead.
- If `ranked_lollipop_card` has `extreme_outlier`, keep the outlier visible and add a second mini-view for the clustered suppliers.
- If `paired_scatter_card` has `heavy_overlap`, use jitter, labeled stacked points, or switch to a ranked table with both metric columns.
- If `paired_scatter_card` has one extreme outlier on either axis, use a quadrant scatter with an outlier annotation and a secondary zoomed inset for the cluster.
- If `category_profile_radar_card` has `radar_dominance`, do not render one shared radar. Use small-multiple single-supplier radars, grouped bars, or a heatmap.
- If `parallel_coordinates_card` has heavy line overlap, use highlighted selected suppliers plus muted context lines, or switch to a heatmap matrix.
- If the chosen chart requires too many explanatory caveats, prefer a table-enhanced card. A clear table is better than a clever but distorted chart.

### Preflight Output Contract

Every card plan should include a `dataShape` block that explains any scale or template adjustment:

```json
{
  "dataShape": {
    "flags": ["extreme_outlier", "heavy_overlap"],
    "scale": "log",
    "fallbackApplied": "log_exposure_bar_card",
    "notes": [
      "Purchase order volume is heavily skewed; log scale prevents one supplier from flattening the rest.",
      "Two suppliers share nearly identical plotted positions; labels should be offset."
    ]
  }
}
```

## Card Template Registry

| Template ID | Best For | Max Suppliers | Primary Encoding | Use When |
|---|---:|---:|---|---|
| `ranked_lollipop_card` | One numeric risk metric | 20 | Sorted dot + line | Buyer asks to compare one score across suppliers |
| `horizontal_bar_card` | One familiar numeric metric | 20 | Sorted horizontal bars | Metric differences are large and simple ranking matters |
| `risk_heatmap_matrix_card` | Many suppliers × many metrics | 20 | Heatmap cells | Buyer asks for broad side-by-side comparison |
| `paired_scatter_card` | Two related numeric metrics | 20 | X/Y scatter | Buyer compares two correlated but distinct metrics |
| `quadrant_scatter_card` | Two metrics with decision zones | 20 | Scatter + quadrant labels | There is a meaningful "good/bad" direction on both axes |
| `parallel_coordinates_card` | 4-8 normalized metrics | 20 | Supplier polylines | Buyer asks to compare several dimensions at once |
| `category_profile_radar_card` | Category rollups | 6 preferred, 10 max | Radar/spider | Small number of suppliers, broad profile shape requested |
| `grouped_metric_table_card` | Full transparency | 20 | Table with grouped metrics | Buyer needs auditability over visual compression |
| `log_exposure_bar_card` | Purchase order volume | 20 | Log-scale bar | Monetary exposure has large range |
| `performance_reliability_card` | Delivery + confirmation + change rate | 20 | Scatter + side ranking | Operational reliability is the decision topic |
| `categorical_distribution_card` | Sourcing or complexity levels | 20 | Chips + grouped counts | Metric is categorical or ordinal |
| `outlier_watchlist_card` | Exception finding | 20 | Ranked alerts | Buyer asks "why", "watch", "red flags", or "surprises" |
| `shortlist_decision_card` | Final supplier choice | 20 | Composite table + callouts | Buyer asks which supplier to choose or justify |

## Card-Specific Distortion Guardrails

### `ranked_lollipop_card`

- Default domain for risk scores: `0-100`.
- If values are tightly clustered, use a zoomed comparison lane with explicit min/max labels and keep the raw value printed next to every supplier.
- If one supplier is far away from the rest, render the outlier as a labeled endpoint and add a compressed cluster lane for the remaining suppliers.
- If multiple suppliers have the same value, stack them as a grouped label rather than drawing dots directly on top of each other.
- If the metric has fewer than four unique values, prefer a table or grouped-count card.

### `horizontal_bar_card`

- Use only when the visual ranking remains readable on the selected scale.
- If the largest value is more than 5x the median, use log scaling or switch to `log_exposure_bar_card`.
- If all bars are almost the same length, add delta-from-median labels or switch to `grouped_metric_table_card`.
- Never use raw linear bars for PO volume across a broad supplier set.

### `paired_scatter_card` and `quadrant_scatter_card`

- Always run point-overlap detection after scaling.
- If points overlap, use deterministic jitter based on supplier ID, offset labels, or stacked point badges.
- If one point stretches the axis, use an annotated outlier plus a zoomed inset for the cluster.
- If both axes are 0-100 risk scores, prefer fixed `0-100` domains unless the card is explicitly a zoomed micro-comparison.
- If the card is zoomed, show the zoomed bounds in the card metadata and interpretation.
- If more than 40% of points overlap after jitter, fall back to a two-column ranked table plus outlier callouts.

### `category_profile_radar_card`

- Use shared radar only for small supplier counts and comparable profile magnitudes.
- If one profile is much larger than the rest, avoid a shared radar because smaller suppliers will be visually crushed.
- Fallbacks in order:
  1. small-multiple radar, one mini radar per supplier
  2. grouped bars by category
  3. heatmap matrix with category rollups
- Do not compare more than 6 suppliers on one radar. For 7-20 suppliers, use `parallel_coordinates_card` or `risk_heatmap_matrix_card`.
- If category axes have very different variance, include raw values or switch to heatmap so low-variance axes do not look falsely important.

### `parallel_coordinates_card`

- Normalize each axis to the same direction before plotting.
- Prefer percentile normalization when metrics have different distributions.
- If many lines overlap, highlight the selected supplier or top/bottom outliers and mute the rest.
- If all suppliers follow almost the same shape, use a summary statement and a grouped table instead of drawing indistinguishable lines.

### `risk_heatmap_matrix_card`

- Heatmaps are robust when bars and dots would distort.
- Use fixed thresholds for risk-color meaning, not only relative colors within the selected suppliers.
- If the selected values are tightly clustered, add raw numeric labels because color alone will not discriminate enough.
- If the request compares many metrics and many suppliers, this should be the fallback card of choice.

### `log_exposure_bar_card`

- Use log scale by default for `Purchase Order Volume (EUR)`.
- Show raw EUR values beside each visual mark.
- Include selected-supplier exposure share when relevant.
- If the selected suppliers have a narrow exposure range, a linear scale is allowed, but the card should record that choice in `dataShape.scale`.

### `categorical_distribution_card`

- Do not force categorical values into numeric geometry.
- If one category dominates, show the dominant category and list exceptions.
- For two categorical metrics, use a matrix instead of two separate cards.

## Single-Metric Routing

### Total_Risk_Index

- Default card: `ranked_lollipop_card`.
- Alternative card: `risk_heatmap_matrix_card` when shown with underlying drivers.
- Sort: ascending, safest first.
- Required fields: `supplierID`, `Supplier Name`, `Total_Risk_Index`, `Total_Risk_Index_Level`.
- Derived fields: rank within selected suppliers, percentile in selected suppliers, safest supplier, riskiest supplier, spread.
- Interpretation focus: overall risk ranking, but warn that low total risk can hide independent geopolitical or environmental exposure.

### Industry_Benchmark_Score

- Default card: `ranked_lollipop_card`.
- Alternative card: `reputation_cluster_card` when compared with media, market sentiment, and external intelligence.
- Sort: ascending.
- Required fields: `Industry_Benchmark_Score`, `Industry_Benchmark_Score_Level`.
- Interpretation focus: peer-relative risk. Treat as contextual evidence, not a standalone decision metric.

### Media_Sentiment_Score

- Default card: `ranked_lollipop_card`.
- Combined card: `reputation_cluster_card` with `Market_Sentiment_Score`, `External_Intelligence_Score`, and `Industry_Benchmark_Score`.
- Sort: descending for watchlist view, ascending for safest view.
- Interpretation focus: external public signal. Useful for shortlist memos because it is easy to explain to stakeholders.

### External_Intelligence_Score

- Default card: `ranked_lollipop_card`.
- Alternative card: `signal_share_card` if the prompt asks which supplier dominates external chatter.
- Combined card: `reputation_cluster_card`.
- Sort: descending for attention, ascending for safest.
- Interpretation focus: third-party intelligence pressure. Flag suppliers far above the shortlist median.

### Sub_Tier_Visibility_Score

- Default card: `ranked_lollipop_card`.
- Combined card: `operational_chain_card` with digital security, operational resilience, and quality risk.
- Sort: descending for opacity watchlist.
- Interpretation focus: visibility into Tier-N suppliers. High score means hidden fragility in the supplier's own network.

### Labor_Stability_Score

- Default card: `ranked_lollipop_card`.
- Combined card: `esg_workforce_card` with safety incident and ESG performance.
- Sort: descending for labor disruption watchlist.
- Interpretation focus: strike, protest, and workforce continuity exposure.

### Financial_Health_Score

- Default card: `paired_scatter_card` with `Credit_Rating_Score`.
- Single-metric fallback: `ranked_lollipop_card`.
- Sort: descending for financial-risk watchlist.
- Required fields: `Financial_Health_Score`, `Financial_Health_Score_Level`, `Credit_Rating_Score` if available.
- Interpretation focus: liquidity, solvency, and bankruptcy risk. Use paired view when possible because credit rating is related but not identical.

### Credit_Rating_Score

- Default card: `paired_scatter_card` with `Financial_Health_Score`.
- Single-metric fallback: `ranked_lollipop_card`.
- Sort: descending for credit watchlist.
- Interpretation focus: creditworthiness. Flag suppliers that have low financial health risk but high credit rating risk, or the reverse.

### Compliance_Risk_Score

- Default card: `paired_scatter_card` with `Governance_Risk_Score`.
- Single-metric fallback: `ranked_lollipop_card`.
- Sort: descending for compliance watchlist.
- Interpretation focus: legal, regulatory, lawsuit, and fine exposure.

### Governance_Risk_Score

- Default card: `paired_scatter_card` with `Compliance_Risk_Score`.
- Single-metric fallback: `ranked_lollipop_card`.
- Sort: descending for governance watchlist.
- Interpretation focus: internal controls, ethics, transparency, and leadership risk.

### Safety_Incident_Score

- Default card: `ranked_lollipop_card`.
- Combined card: `esg_workforce_card` with labor stability and ESG performance.
- Sort: descending for safety watchlist.
- Interpretation focus: industrial accident and safety violation risk. Important for train-part sourcing because safety failures are directly tied to operational and reputational consequences.

### Environmental_Exposure_Score

- Default card: `ranked_lollipop_card`.
- Combined card: `geopolitical_external_card` with geopolitical risk and political stability.
- Sort: descending for environmental exposure watchlist.
- Interpretation focus: natural hazard, climate, and geography-driven risk. Keep separate from ESG performance because it measures exposure, not supplier behavior.

### ESG_Performance_Score

- Default card: `ranked_lollipop_card`.
- Combined card: `esg_workforce_card` with labor stability and safety incident.
- Alternative card: `signal_share_card` if the buyer asks whose ESG risk dominates the shortlist.
- Sort: descending for ESG watchlist.
- Interpretation focus: sustainability and ethical performance. Use as headline ESG signal, with labor and safety as supporting dimensions.

### Digital_Security_Score

- Default card: `ranked_lollipop_card`.
- Combined card: `operational_chain_card` with operational resilience, sub-tier visibility, and quality risk.
- Sort: descending for cyber watchlist.
- Interpretation focus: breach, hacking, and digital infrastructure exposure.

### Operational_Resilience_Score

- Default card: `paired_scatter_card` with `Quality_Risk_Score`.
- Combined card: `operational_chain_card`.
- Sort: descending for operational watchlist.
- Interpretation focus: production and logistics continuity. Strong driver of total risk, so useful when explaining why a supplier is high-risk.

### Market_Sentiment_Score

- Default card: `ranked_lollipop_card`.
- Combined card: `reputation_cluster_card`.
- Sort: descending for perception risk.
- Interpretation focus: public and market perception. If media sentiment is also requested, prefer combined reputation view over separate cards.

### Quality_Risk_Score

- Default card: `paired_scatter_card` with `Operational_Resilience_Score`.
- Combined card: `operational_chain_card`.
- Sort: descending for quality watchlist.
- Interpretation focus: defects, recalls, and quality management risk. Strong practical relevance for train components.

### Geopolitical_Risk_Score

- Default card: `ranked_lollipop_card`.
- Combined card: `geopolitical_external_card` with political stability and environmental exposure.
- Alternative card: `quadrant_scatter_card` with `Political_Stability_Score`.
- Sort: descending for geopolitical watchlist.
- Interpretation focus: hidden external risk. This is weakly correlated with total risk, so it should often be surfaced even when overall risk looks low.

### Political_Stability_Score

- Default card: `ranked_lollipop_card`.
- Combined card: `geopolitical_external_card`.
- Alternative card: `quadrant_scatter_card` with `Geopolitical_Risk_Score`.
- Sort: descending for political instability watchlist.
- Interpretation focus: country or regional political uncertainty affecting supplier operations.

### Purchase Order Volume (EUR)

- Default card: `log_exposure_bar_card`.
- Alternative card: `exposure_vs_risk_card` with `Total_Risk_Index`.
- Sort: descending by exposure.
- Required fields: `Purchase Order Volume (EUR)`, `Total_Risk_Index` if paired.
- Derived fields: total exposure across selected suppliers, supplier share of selected exposure, log-scaled bar width, highest exposure supplier.
- Interpretation focus: materiality. Never call this risk; call it spend exposure or contract exposure.

### Order Change Rate

- Default card: `ranked_lollipop_card`.
- Combined card: `performance_reliability_card` with delivery rating and confirmation rate.
- Sort: descending for process instability watchlist.
- Interpretation focus: planning volatility, order churn, and procurement friction.

### Supplier Delivery Rating

- Default card: `paired_scatter_card` with `Order Confirmation Rate`.
- Combined card: `performance_reliability_card` with order change rate.
- Sort: ascending for worst delivery watchlist, descending for best supplier selection.
- Interpretation focus: delivery accuracy and timeliness. Higher is better.

### Order Confirmation Rate

- Default card: `paired_scatter_card` with `Supplier Delivery Rating`.
- Combined card: `performance_reliability_card`.
- Sort: ascending for confirmation watchlist, descending for best supplier selection.
- Interpretation focus: supplier responsiveness and order process reliability. Higher is better.

### Sourcing Risk Level

- Default card: `categorical_distribution_card`.
- Combined card: `replaceability_complexity_card` with `Supply Chain Complexity`.
- Sort: High, Medium, Low for watchlist; Low, Medium, High for safest view.
- Interpretation focus: replacement difficulty and sourcing flexibility.

### Supply Chain Complexity

- Default card: `categorical_distribution_card`.
- Combined card: `replaceability_complexity_card` with `Sourcing Risk Level`.
- Sort: Complex, Moderate, Simple for watchlist; Simple, Moderate, Complex for safest view.
- Interpretation focus: logistics and supply-network complexity.

## Combined-Metric Card Templates

### `overall_supplier_benchmark_card`

- Trigger examples:
  - "Compare the top 20 suppliers."
  - "Summarize a comparison of these suppliers."
  - "Which supplier is best overall?"
- Metrics:
  - `Total_Risk_Index`
  - all 18 underlying risk scores
  - `Purchase Order Volume (EUR)`
  - `Order Change Rate`
  - `Supplier Delivery Rating`
  - `Order Confirmation Rate`
  - `Sourcing Risk Level`
  - `Supply Chain Complexity`
- Recommended structure:
  - headline shortlist summary
  - key callouts: safest overall, highest hidden external risk, largest exposure, weakest operational reliability
  - grouped heatmap matrix for all risk metrics
  - compact operational/exposure section
- Do not use one giant radar for 20 suppliers.
- Use this as the default landing or broad comparison card.

### `financial_credit_card`

- Metrics:
  - `Financial_Health_Score`
  - `Credit_Rating_Score`
- Template: `paired_scatter_card`.
- X-axis: Financial Health Score.
- Y-axis: Credit Rating Score.
- Good zone: bottom-left.
- Watch zones:
  - high financial + high credit = serious financial concern
  - low financial + high credit = credit-specific concern
  - high financial + low credit = liquidity/health concern not reflected by credit score
- Best for questions about financial risk, bankruptcy risk, or creditworthiness.

### `compliance_governance_card`

- Metrics:
  - `Compliance_Risk_Score`
  - `Governance_Risk_Score`
- Template: `paired_scatter_card`.
- X-axis: Compliance Risk.
- Y-axis: Governance Risk.
- Good zone: bottom-left.
- Interpretation:
  - high compliance + high governance: regulatory and controls concern
  - high compliance only: legal/fines/litigation concern
  - high governance only: internal controls or ethics concern
- Best for auditability and final sourcing justification.

### `geopolitical_external_card`

- Metrics:
  - `Geopolitical_Risk_Score`
  - `Political_Stability_Score`
  - `Environmental_Exposure_Score`
- Template: `parallel_coordinates_card` for 8-20 suppliers, or compact grouped lollipop set.
- Alternative: `category_profile_radar_card` for 3-6 suppliers.
- Interpretation:
  - These metrics are less correlated with the rest of the risk model.
  - A supplier can look safe overall and still be a hidden outlier here.
  - Keep all three dimensions visible; do not collapse into one opaque score unless also showing the raw values.
- Best for external disruption, region, climate, political, or country-risk questions.

### `esg_workforce_card`

- Metrics:
  - `ESG_Performance_Score`
  - `Labor_Stability_Score`
  - `Safety_Incident_Score`
- Template: grouped lollipop set or `parallel_coordinates_card`.
- Alternative: `category_profile_radar_card` for 3-6 suppliers.
- Interpretation:
  - ESG is the headline sustainability signal.
  - Labor stability explains workforce continuity risk.
  - Safety incident risk is especially important for industrial suppliers.
- Best for sustainability, labor, human rights, safety, and workforce disruption questions.

### `operational_chain_card`

- Metrics:
  - `Operational_Resilience_Score`
  - `Quality_Risk_Score`
  - `Sub_Tier_Visibility_Score`
  - `Digital_Security_Score`
- Template: `parallel_coordinates_card` or grouped heatmap.
- Paired focus option: `paired_scatter_card` using `Quality_Risk_Score` vs `Operational_Resilience_Score`.
- Interpretation:
  - Quality and operational resilience explain production reliability.
  - Sub-tier visibility explains supplier-network opacity.
  - Digital security explains cyber or infrastructure fragility.
- Best for train-part reliability and operational continuity questions.

### `reputation_cluster_card`

- Metrics:
  - `Media_Sentiment_Score`
  - `Market_Sentiment_Score`
  - `External_Intelligence_Score`
  - `Industry_Benchmark_Score`
- Template: grouped lollipop set or `parallel_coordinates_card`.
- Alternative: `signal_share_card` for external intelligence or media-heavy prompts.
- Interpretation:
  - These metrics overlap statistically, so the card should avoid repeating the same message four times.
  - Use a cluster summary plus raw metric rows.
  - Flag the one supplier with the worst reputation cluster average and the supplier with the largest individual spike.
- Best for news, public perception, benchmark, and external intelligence questions.

### `performance_reliability_card`

- Metrics:
  - `Supplier Delivery Rating`
  - `Order Confirmation Rate`
  - `Order Change Rate`
- Template: `quadrant_scatter_card` plus ranked side list.
- X-axis: Supplier Delivery Rating.
- Y-axis: Order Confirmation Rate.
- Dot size or side annotation: Order Change Rate.
- Good zone: top-right with low order change rate.
- Watch zone: low delivery, low confirmation, or high order change rate.
- Best for operational performance and execution reliability.

### `exposure_vs_risk_card`

- Metrics:
  - `Purchase Order Volume (EUR)`
  - `Total_Risk_Index`
- Template: `quadrant_scatter_card`.
- X-axis: log-scaled Purchase Order Volume.
- Y-axis: Total Risk Index.
- Quadrants:
  - high exposure + high risk: immediate review
  - high exposure + low risk: strategically important but currently safe
  - low exposure + high risk: contain or deprioritize
  - low exposure + low risk: low concern
- Best for sourcing prioritization and management attention.

### `replaceability_complexity_card`

- Metrics:
  - `Sourcing Risk Level`
  - `Supply Chain Complexity`
- Template: `categorical_distribution_card` or 3x3 categorical matrix.
- Rows: Sourcing Risk Level (`Low`, `Medium`, `High`).
- Columns: Supply Chain Complexity (`Simple`, `Moderate`, `Complex`).
- Cell contents: suppliers in that category combination.
- Highest concern: `High` sourcing risk + `Complex` supply chain.
- Best for replacement difficulty and supplier contingency planning.

### `shortlist_decision_card`

- Trigger examples:
  - "Which supplier should we choose?"
  - "Justify the final supplier choice."
  - "Create a shortlist memo."
- Metrics:
  - `Total_Risk_Index`
  - buyer-selected focus metrics if any
  - `Purchase Order Volume (EUR)`
  - `Supplier Delivery Rating`
  - `Order Confirmation Rate`
  - `Sourcing Risk Level`
  - `Supply Chain Complexity`
- Template: composite table with three generated sections.
- Sections:
  - recommended supplier
  - tradeoffs and watchouts
  - why not the runner-up suppliers
- This card should not hide raw values; include enough metric evidence to support the recommendation.

## Harness-Friendly Metric Map

Use this table as a direct routing map from detected metric key to preferred card.

| Metric Key | Default Card | Preferred Combined Card | Sort Direction | Value Direction |
|---|---|---|---|---|
| `Total_Risk_Index` | `ranked_lollipop_card` | `overall_supplier_benchmark_card` | ascending | lower is better |
| `Industry_Benchmark_Score` | `ranked_lollipop_card` | `reputation_cluster_card` | ascending or descending by intent | lower is better |
| `Media_Sentiment_Score` | `ranked_lollipop_card` | `reputation_cluster_card` | descending for watchlist | lower is better |
| `External_Intelligence_Score` | `ranked_lollipop_card` | `reputation_cluster_card` | descending for watchlist | lower is better |
| `Sub_Tier_Visibility_Score` | `ranked_lollipop_card` | `operational_chain_card` | descending for watchlist | lower is better |
| `Labor_Stability_Score` | `ranked_lollipop_card` | `esg_workforce_card` | descending for watchlist | lower is better |
| `Financial_Health_Score` | `paired_scatter_card` | `financial_credit_card` | descending for watchlist | lower is better |
| `Credit_Rating_Score` | `paired_scatter_card` | `financial_credit_card` | descending for watchlist | lower is better |
| `Compliance_Risk_Score` | `paired_scatter_card` | `compliance_governance_card` | descending for watchlist | lower is better |
| `Governance_Risk_Score` | `paired_scatter_card` | `compliance_governance_card` | descending for watchlist | lower is better |
| `Safety_Incident_Score` | `ranked_lollipop_card` | `esg_workforce_card` | descending for watchlist | lower is better |
| `Environmental_Exposure_Score` | `ranked_lollipop_card` | `geopolitical_external_card` | descending for watchlist | lower is better |
| `ESG_Performance_Score` | `ranked_lollipop_card` | `esg_workforce_card` | descending for watchlist | lower is better |
| `Digital_Security_Score` | `ranked_lollipop_card` | `operational_chain_card` | descending for watchlist | lower is better |
| `Operational_Resilience_Score` | `paired_scatter_card` | `operational_chain_card` | descending for watchlist | lower is better |
| `Market_Sentiment_Score` | `ranked_lollipop_card` | `reputation_cluster_card` | descending for watchlist | lower is better |
| `Quality_Risk_Score` | `paired_scatter_card` | `operational_chain_card` | descending for watchlist | lower is better |
| `Geopolitical_Risk_Score` | `ranked_lollipop_card` | `geopolitical_external_card` | descending for watchlist | lower is better |
| `Political_Stability_Score` | `ranked_lollipop_card` | `geopolitical_external_card` | descending for watchlist | lower is better |
| `Purchase Order Volume (EUR)` | `log_exposure_bar_card` | `exposure_vs_risk_card` | descending | higher means more exposure |
| `Order Change Rate` | `ranked_lollipop_card` | `performance_reliability_card` | descending for watchlist | lower is better |
| `Supplier Delivery Rating` | `paired_scatter_card` | `performance_reliability_card` | descending for best | higher is better |
| `Order Confirmation Rate` | `paired_scatter_card` | `performance_reliability_card` | descending for best | higher is better |
| `Sourcing Risk Level` | `categorical_distribution_card` | `replaceability_complexity_card` | High to Low for watchlist | Low is better |
| `Supply Chain Complexity` | `categorical_distribution_card` | `replaceability_complexity_card` | Complex to Simple for watchlist | Simple is better |

## Recommended Card Data Contract

Each generated card should receive this shape after metric routing:

```json
{
  "cardTemplateId": "financial_credit_card",
  "title": "Financial and Credit Risk Comparison",
  "supplierLimit": 20,
  "metrics": ["Financial_Health_Score", "Credit_Rating_Score"],
  "valueDirection": "lower_is_better",
  "sort": {
    "field": "Financial_Health_Score",
    "direction": "desc"
  },
  "dataShape": {
    "flags": [],
    "scale": "fixed_0_100",
    "fallbackApplied": null,
    "notes": []
  },
  "suppliers": [
    {
      "supplierID": "SUPP_00012",
      "supplierName": "Dynamic Group 434",
      "values": {
        "Financial_Health_Score": 54,
        "Credit_Rating_Score": 57
      },
      "levels": {
        "Financial_Health_Score_Level": "High",
        "Credit_Rating_Score_Level": "High"
      }
    }
  ]
}
```

## Interpretation Rules

- Always state whether lower or higher values are better for the selected metric.
- For risk scores, identify highest-risk and lowest-risk suppliers in the selected group.
- For paired scatter cards, identify quadrant outliers.
- For grouped cards, identify the worst supplier by group average and the worst single-metric spike.
- For exposure cards, explicitly separate exposure from risk.
- For categorical cards, identify the suppliers in the highest-concern category combination.
- If the selected suppliers are all tightly clustered, say that the metric is not discriminating strongly for this shortlist.
- If a supplier has low `Total_Risk_Index` but a high independent external metric, flag it as a hidden watchout.

## Creative Card Ideas Worth Implementing Later

### `metric_spike_strip_card`

- Shows one compact row per supplier.
- Each row displays only metrics where that supplier is worse than the shortlist median by a configured threshold.
- Best for explaining "why is this supplier risky?" without showing every metric.

### `shortlist_tradeoff_card`

- Shows each supplier as a candidate with three labels: strongest reason to choose, biggest watchout, and exposure level.
- Best for final buyer decision support.

### `hidden_outlier_card`

- Searches for suppliers with low total risk but high individual risk in independent metrics such as geopolitical, political, or environmental exposure.
- Best for surprise/insight moments in a demo.

### `risk_vs_performance_card`

- Compares `Total_Risk_Index` against a combined operational performance score derived from delivery and confirmation.
- Best for finding suppliers that are both safe and operationally reliable.

### `category_rollup_profile_card`

- Computes category averages for financial, governance, operational, ESG/reputation, and geopolitical/external groups.
- Uses radar only for small supplier counts; for larger groups, use grouped bars or parallel coordinates.
- Best when the user asks for "risk profiles" rather than one metric.

## Implementation Notes

- Prefer single-metric cards for direct questions.
- Prefer combined cards when the requested metrics are part of the same natural cluster.
- Do not render more than one dense matrix at a time.
- Do not use radar charts for 20 suppliers.
- Do not use linear bars for purchase order volume unless the selected values are already in a narrow range.
- Use the `_Level` columns for labels, filters, and summaries; use numeric score columns for chart geometry.
- Keep raw numbers accessible even when using charts, because procurement decisions need defensible evidence.
- Always run the data shape preflight before rendering chart geometry.
- Store the chosen scale and any fallback in the card payload so the UI and generated explanation agree.
- Prefer fixed `0-100` scales for risk comparability, but allow zoomed insets when a tight cluster would otherwise be unreadable.
- Prefer log, percentile, or split-panel encodings when raw values would compress most suppliers into the same visual area.
- If a visualization needs jitter or zooming, keep the raw value visible so the buyer does not confuse visual offsets with actual data differences.
- If the preflight flags multiple readability issues, choose the more explainable card, not the more decorative card.