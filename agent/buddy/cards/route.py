"""Template routing: the spec's Template Selection Flow + Harness-Friendly Metric Map, as code.

docs/specs/comparison-card-template-spec.md. Templates the MVP can't draw yet (parallel coordinates,
radar) use the spec's own fallbacks (grouped bars = `rank`, heatmap = `table`).
"""

import statistics as st
from dataclasses import dataclass, field

from buddy.cards import data
from buddy.cards.schema import CLUSTERS, LABELS, VALUE_DIRECTION

TRI = "Total_Risk_Index"
PO = "Purchase Order Volume (EUR)"
DEL, CONF, OCR = "Supplier Delivery Rating", "Order Confirmation Rate", "Order Change Rate"
SRC, SCC = "Sourcing Risk Level", "Supply Chain Complexity"
RISK_KEYS = [TRI] + [k for k in VALUE_DIRECTION if k.endswith("_Score")]

# Spec metric map: metrics whose default card is a paired scatter, and their partner.
PAIRS = {
    "Financial_Health_Score": "Credit_Rating_Score",
    "Credit_Rating_Score": "Financial_Health_Score",
    "Compliance_Risk_Score": "Governance_Risk_Score",
    "Governance_Risk_Score": "Compliance_Risk_Score",
    "Operational_Resilience_Score": "Quality_Risk_Score",
    "Quality_Risk_Score": "Operational_Resilience_Score",
    DEL: CONF,
    CONF: DEL,
}

# (template, renderer, title) for 2-metric pairs and 3-6 metric clusters.
PAIR_CARDS = {
    frozenset({"Financial_Health_Score", "Credit_Rating_Score"}): ("financial_credit_card", "Financial health vs credit rating"),
    frozenset({"Compliance_Risk_Score", "Governance_Risk_Score"}): ("compliance_governance_card", "Compliance vs governance risk"),
    frozenset({"Operational_Resilience_Score", "Quality_Risk_Score"}): ("paired_scatter_card", "Operational resilience vs quality risk"),
    frozenset({DEL, CONF}): ("performance_reliability_card", "Delivery vs order confirmation"),
    frozenset({PO, TRI}): ("exposure_vs_risk_card", "Spend exposure vs total risk"),
}
CLUSTER_CARDS = {
    "esg_workforce": ("esg_workforce_card", "rank", "ESG and workforce"),
    "reputation": ("reputation_cluster_card", "rank", "Reputation signals"),
    "geopolitical_external": ("geopolitical_external_card", "rank", "Geopolitical and external exposure"),
    "operational_chain": ("operational_chain_card", "table", "Operational chain"),
    "performance": ("performance_reliability_card", "scatter", "Operational performance"),
}


@dataclass
class Route:
    template: str
    renderer: str
    title: str
    metrics: list[str]
    sort_field: str
    sort_desc: bool
    quadrants: dict | None = None
    notes: list[str] = field(default_factory=list)


def _sort_desc(metric: str, direction: str) -> bool:
    """Best first for 'safest', worst first for 'watch'. Spend is always largest first."""
    vd = VALUE_DIRECTION[metric]
    if vd == "higher_means_more_exposure":
        return True
    if vd == "categorical":
        return direction == "watch"
    best_first_desc = vd == "higher_is_better"
    return best_first_desc if direction == "safest" else not best_first_desc


def _quadrants(template: str, x: str, y: str, ids: list[str]) -> dict:
    rows = [data.by_id()[i] for i in ids]
    med = lambda k: round(st.median(r[k] for r in rows), 2)
    if template == "performance_reliability_card":
        return {"x": DEL, "y": CONF, "xThreshold": med(DEL), "yThreshold": med(CONF), "goodZone": "topRight",
                "labels": {"topLeft": "Confirms but delivers late", "topRight": "Reliable",
                           "bottomLeft": "Weak on both", "bottomRight": "Delivers but confirms slowly"}}
    if template == "exposure_vs_risk_card":
        return {"x": PO, "y": TRI, "xThreshold": med(PO), "yThreshold": 50, "goodZone": "bottomLeft",
                "labels": {"topLeft": "Contain or deprioritize", "topRight": "Immediate review",
                           "bottomLeft": "Low concern", "bottomRight": "Important, currently safe"}}
    labels = {
        "financial_credit_card": {"topLeft": "Credit-specific concern", "topRight": "Serious financial concern",
                                  "bottomLeft": "Low financial risk", "bottomRight": "Health concern not in credit score"},
        "compliance_governance_card": {"topLeft": "Internal controls / ethics concern", "topRight": "Regulatory and controls concern",
                                       "bottomLeft": "Low concern", "bottomRight": "Legal / fines concern"},
    }.get(template, {"topLeft": f"High {LABELS[y].lower()} only", "topRight": "High on both",
                     "bottomLeft": "Low on both", "bottomRight": f"High {LABELS[x].lower()} only"})
    # Risk axes split at 50, where the High band starts (identical bands for every score).
    return {"x": x, "y": y, "xThreshold": 50, "yThreshold": 50, "goodZone": "bottomLeft", "labels": labels}


def _scatter(template: str, title: str, x: str, y: str, ids: list[str], direction: str, extra: list[str] = ()) -> Route:
    return Route(template, "scatter", title, [x, y, *extra], x, _sort_desc(x, direction), _quadrants(template, x, y, ids))


def _cluster_of(metrics: list[str]) -> str | None:
    for name, members in CLUSTERS.items():
        if set(metrics) <= set(members):
            return name
    return None


def route(intent: str, direction: str, metrics: list[str], ids: list[str]) -> Route:
    m = list(dict.fromkeys(metrics))  # dedupe, keep order

    if intent == "overview" or (intent == "compare" and not m):
        cols = RISK_KEYS + [PO, DEL, CONF]
        return Route("overall_supplier_benchmark_card", "table", "Overall supplier benchmark", cols, TRI, _sort_desc(TRI, direction))
    if intent == "choose":
        cols = list(dict.fromkeys([TRI, *m, PO, DEL, CONF, SRC, SCC]))
        return Route("shortlist_decision_card", "table", "Shortlist decision", cols, TRI, False)
    if intent == "watchlist":
        if not m or m == [TRI]:  # "hidden risks behind a low total risk" is the hidden-outlier view
            cols = [TRI, "Geopolitical_Risk_Score", "Political_Stability_Score", "Environmental_Exposure_Score"]
            return Route("hidden_outlier_card", "table", "Hidden risks behind low total risk", cols, TRI, False)
        cols = list(dict.fromkeys([*m, TRI]))
        return Route("outlier_watchlist_card", "table", "Watchlist", cols, m[0], _sort_desc(m[0], "watch"))
    if intent == "exposure":
        if m == [PO]:
            return Route("log_exposure_bar_card", "rank", "Spend exposure", [PO], PO, True)
        return _scatter("exposure_vs_risk_card", PAIR_CARDS[frozenset({PO, TRI})][1], PO, TRI, ids, direction)

    # intent == "compare": decided purely by the metrics
    if len(m) == 1:
        (k,) = m
        if k in PAIRS:  # spec default for these metrics is the paired scatter with their partner
            pair = frozenset({k, PAIRS[k]})
            template, title = PAIR_CARDS[pair]
            x, y = (k, PAIRS[k]) if k not in (CONF,) else (DEL, CONF)
            extra = [OCR] if template == "performance_reliability_card" else []
            return _scatter(template, title, x, y, ids, direction, extra)
        if k == PO:
            return Route("log_exposure_bar_card", "rank", "Spend exposure", [PO], PO, True)
        if k in (SRC, SCC):
            return Route("replaceability_complexity_card", "table", "Replaceability vs supply chain complexity", [SRC, SCC], SRC,
                         _sort_desc(SRC, direction))
        return Route("ranked_lollipop_card", "rank", LABELS[k], [k], k, _sort_desc(k, direction))
    if len(m) == 2:
        pair = frozenset(m)
        if pair in PAIR_CARDS:
            template, title = PAIR_CARDS[pair]
            x, y = m[0], m[1]
            if template == "performance_reliability_card":
                return _scatter(template, title, DEL, CONF, ids, direction, [OCR])
            if template == "exposure_vs_risk_card":
                return _scatter(template, title, PO, TRI, ids, direction)
            return _scatter(template, title, x, y, ids, direction)
        if pair == {SRC, SCC}:
            return Route("replaceability_complexity_card", "table", "Replaceability vs supply chain complexity", [SRC, SCC], SRC,
                         _sort_desc(SRC, direction))
        if all(k in RISK_KEYS for k in m):
            return _scatter("paired_scatter_card", f"{LABELS[m[0]]} vs {LABELS[m[1]].lower()}", m[0], m[1], ids, direction)
    cluster = _cluster_of(m) if 3 <= len(m) <= 6 else None
    if cluster in CLUSTER_CARDS:
        template, renderer, title = CLUSTER_CARDS[cluster]
        if renderer == "scatter":
            return _scatter(template, title, DEL, CONF, ids, direction, [OCR])
        return Route(template, renderer, title, m, m[0], _sort_desc(m[0], direction))
    # Mixed or many metrics: the spec's fallback of choice.
    return Route("risk_heatmap_matrix_card", "table", "Side-by-side comparison", m, m[0], _sort_desc(m[0], direction))
