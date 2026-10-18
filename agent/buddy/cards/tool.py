"""`compare_suppliers`: the only tool of the supplier-comparison-cards skill (plan 05).

The agent fills the arguments (understanding the language); everything else here is deterministic.
The returned card is rendered by the frontend straight from the tool result.
"""

import hashlib
import json
import logging
from typing import Literal

from google.adk.tools import ToolContext

from buddy.cards import data
from buddy.cards.facts import compute
from buddy.cards.preflight import preflight
from buddy.cards.route import route
from buddy.cards.schema import GLOSSARY, LABELS, VALUE_DIRECTION, Card, Direction, Intent, Mention, MetricKey, ToolResult
from buddy.cards.select import select_suppliers
from buddy.cards.summary import write
from buddy.cards.validate import clean_enums, needs_choice, resolve_intent, supplier_ids_in

log = logging.getLogger(__name__)

CATEGORY_ORDER = {"Low": 0, "Medium": 1, "High": 2, "Simple": 0, "Moderate": 1, "Complex": 2}
_results_by_invocation: dict[str, dict] = {}  # one card per agent turn, even if the model calls twice


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


def compare_suppliers(
    request: str,
    intent: Intent,
    direction: Direction,
    mentions: list[Mention] = [],
    supplier_ids: list[str] = [],
    use_compare_tray: bool = False,
    rank_by: MetricKey | None = None,
    rank_order: Literal["lowest", "highest"] | None = None,
    limit: int | None = None,
    tool_context: ToolContext | None = None,
) -> dict:
    invocation = getattr(tool_context, "invocation_id", None)
    if invocation and invocation in _results_by_invocation:
        return _results_by_invocation[invocation]  # already answered this turn: same card, no second card
    try:
        result = _compare(request, intent, direction, mentions, use_compare_tray, rank_by, rank_order, limit, tool_context)
    except Exception:  # never crash the agent run: a failed card is an answerable error
        log.exception("compare_suppliers failed for request %r", request)
        result = ToolResult(status="error", message="Sorry, I couldn't build that comparison card. Try naming the suppliers "
                                                    "and the metric more explicitly.").model_dump(exclude_none=True)
    if invocation and result["status"] == "ok":
        _results_by_invocation[invocation] = result
    return result


def _compare(request, intent, direction, mentions, use_compare_tray, rank_by, rank_order, limit, tool_context) -> dict:
    ms =[m if isinstance(m, dict) else m.model_dump() for m in mentions]
    for m in ms:
        m["metrics"] = clean_enums("compare", "safest", m["metrics"], None)[2]
    for m in ms:  # ambiguity -> the buyer chooses one option
        if needs_choice(m["metrics"], request):
            options = [f"{LABELS[k]}: {GLOSSARY[k]}" for k in m["metrics"]]
            return ToolResult(status="needs_clarification",
                              question=f"'{m['phrase']}' can mean different things. Which one should I compare?",
                              options=options).model_dump(exclude_none=True)
    metrics = list(dict.fromkeys(k for m in ms for k in m["metrics"]))  # mentions with no metric add nothing
    intent, direction, metrics, rank_by = clean_enums(intent, direction, metrics, rank_by)
    intent = resolve_intent(intent, metrics)

    # Supplier IDs come only from the buyer's own words; anything else the model passed is dropped.
    request_ids = supplier_ids_in(request)
    tray = (tool_context.state.get("ui") or {}).get("compare_tray", []) if tool_context else []
    sel = select_suppliers(request_ids, tray, use_compare_tray, rank_by, rank_order, limit, direction)
    if sel.question:
        return ToolResult(status="needs_clarification", question=sel.question,
                          options=["Name supplier IDs", "The 10 safest by total risk", "The 10 riskiest by total risk"]
                          ).model_dump(exclude_none=True)
    if sel.error:
        return ToolResult(status="error", message=sel.error).model_dump(exclude_none=True)

    card = build_card(intent, direction, metrics, sel.ids)
    return ToolResult(status="ok", card=card, summary=card["summary"]).model_dump(exclude_none=True)


compare_suppliers.__doc__ = (
    "Build a supplier comparison card and show it on the dashboard. Follow the supplier-comparison-cards skill "
    "procedure to fill the arguments.\n\nMetric glossary (key: meaning):\n"
    + "\n".join(f"- {k}: {v}" for k, v in GLOSSARY.items())
)
