"""Composite cards: several topics the buyer named -> one card with a panel (its own chart) per topic.

Each panel is an ordinary card built by `build_card`, so it gets its spec default chart: a ranking, a log
scale for spend, a scatter for a known pair. Topics that belong together stay in one panel: a spec pair
(financial health + credit rating) or 3+ metrics of one cluster (ESG, labor, safety).
"""

import hashlib
import json
import re

from buddy.cards import data
from buddy.cards.build import build_card
from buddy.cards.route import CLUSTER_CARDS, PAIR_CARDS
from buddy.cards.schema import CLUSTERS, LABELS, VALUE_DIRECTION, Card

MAX_PANELS = 6
CLUSTER_OF = {m: name for name, members in CLUSTERS.items() for m in members}
# "All metrics": the overview heatmap first, then one panel per metric family.
ALL_FAMILIES = ["financial", "compliance_governance", "esg_workforce", "geopolitical_external", "reputation", "performance"]


def panel_groups(groups: list[list[str]]) -> list[list[str]]:
    """Metric groups (one per buyer topic) -> panels, in the order the buyer named them."""
    order: list[str] = []
    buckets: dict[str, list[str]] = {}
    for group in groups:
        for m in group:
            c = CLUSTER_OF[m]
            if c not in buckets:
                buckets[c] = []
                order.append(c)
            if m not in buckets[c]:
                buckets[c].append(m)
    panels: list[list[str]] = []
    for c in order:
        ms = buckets[c]
        together = (len(ms) == 1 or frozenset(ms) in PAIR_CARDS or c == "replaceability"
                    or (len(ms) >= 3 and c in CLUSTER_CARDS))
        panels.extend([ms] if together else [[m] for m in ms])
    return panels


def build_composite(direction: str, panels_metrics: list[list[str]], ids: list[str], *, all_metrics: bool = False) -> dict:
    panels = [build_card("overview", direction, [], ids)] if all_metrics else []
    panels += [build_card("compare", direction, g, ids) for g in panels_metrics]
    metrics = list(dict.fromkeys(m for p in panels for m in p["metrics"]))
    by_id = data.by_id()
    first_order = [s["supplierID"] for s in panels[0]["suppliers"]]
    title = "Full supplier analysis" if all_metrics else _join([p["title"] for p in panels])
    if all_metrics:
        summary = f"{panels[0]['summary']} Detail panels: {_join([p['title'] for p in panels[1:]]).lower()}."
    else:
        summary = " ".join(f"{p['title']}: {_short(p['summary'])}" for p in panels)
    card = {
        "cardId": hashlib.sha1(json.dumps(["composite", [p["cardId"] for p in panels]]).encode()).hexdigest()[:12],
        "renderer": "composite",
        "template": "composite_card",
        "title": title,
        "intent": "overview" if all_metrics else "compare",
        "direction": direction,
        "metrics": metrics,
        "metricLabels": {k: LABELS[k] for k in metrics},
        "valueDirection": {k: VALUE_DIRECTION[k] for k in metrics},
        "sort": panels[0]["sort"],
        "dataShape": {"flags": [], "scale": "fixed_0_100", "fallbackApplied": None, "notes": []},
        "quadrants": None,
        "suppliers": [{"supplierID": i, "supplierName": by_id[i]["Supplier Name"], "values": {}, "levels": {}, "flags": []}
                      for i in first_order],
        "facts": {"template": "composite_card", "panels": [p["template"] for p in panels]},
        "summary": summary,
        "panels": panels,
    }
    return Card.model_validate(card).model_dump()


def build_all_metrics(direction: str, ids: list[str]) -> dict:
    return build_composite(direction, [CLUSTERS[f] for f in ALL_FAMILIES], ids, all_metrics=True)


def _join(titles: list[str]) -> str:
    return titles[0] if len(titles) == 1 else ", ".join(titles[:-1]) + " & " + titles[-1]


def _short(summary: str) -> str:
    """Drop the leading "Lower is better for X." so each panel's line starts with its finding."""
    return re.sub(r"^(?:Lower|Higher) is better(?: for [^.]*)?\.\s*", "", summary)
