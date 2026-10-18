"""One card from (intent, direction, metrics, suppliers): route -> preflight -> facts -> summary."""

import hashlib
import json

from buddy.cards import data
from buddy.cards.facts import compute
from buddy.cards.preflight import preflight
from buddy.cards.route import route
from buddy.cards.schema import LABELS, VALUE_DIRECTION, Card
from buddy.cards.summary import write

CATEGORY_ORDER = {"Low": 0, "Medium": 1, "High": 2, "Simple": 0, "Moderate": 1, "Complex": 2}


def build_card(intent: str, direction: str, metrics: list[str], ids: list[str]) -> dict:
    rows = [data.by_id()[i] for i in ids]
    r = route(intent, direction, metrics, ids)
    r, shape = preflight(r, rows)
    facts, flags = compute(r, rows)
    key = (lambda row: CATEGORY_ORDER[row[r.sort_field]]) if VALUE_DIRECTION[r.sort_field] == "categorical" else (lambda row: row[r.sort_field])
    rows = sorted(rows, key=lambda row: (key(row), row["supplierID"]), reverse=r.sort_desc)
    card = {
        "cardId": hashlib.sha1(json.dumps([r.template, r.metrics, ids, direction]).encode()).hexdigest()[:12],
        "renderer": r.renderer, "template": r.template, "title": r.title, "intent": intent, "direction": direction,
        "metrics": r.metrics, "metricLabels": {k: LABELS[k] for k in r.metrics},
        "valueDirection": {k: VALUE_DIRECTION[k] for k in r.metrics},
        "sort": {"field": r.sort_field, "direction": "desc" if r.sort_desc else "asc"},
        "dataShape": shape.model_dump(), "quadrants": r.quadrants,
        "suppliers": [{
            "supplierID": row["supplierID"], "supplierName": row["Supplier Name"],
            "values": {k: row[k] for k in r.metrics},
            "levels": {f"{k}_Level": row[f"{k}_Level"] for k in r.metrics if f"{k}_Level" in row},
            "flags": flags[row["supplierID"]],
        } for row in rows],
        "facts": facts, "summary": "",
    }
    card["summary"] = write(card)
    return Card.model_validate(card).model_dump()
