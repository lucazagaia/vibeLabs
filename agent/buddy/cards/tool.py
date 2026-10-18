"""`compare_suppliers`: the only tool of the supplier-comparison-cards skill (plan 05).

The agent fills the arguments (understanding the language); everything else here is deterministic.
The returned card is rendered by the frontend straight from the tool result.
"""

import logging
from typing import Literal

from google.adk.tools import ToolContext
from google.genai import types

from buddy.cards.build import build_card  # noqa: F401  (re-exported: tests and make_fixtures import it from here)
from buddy.cards.composite import MAX_PANELS, build_all_metrics, build_composite, panel_groups
from buddy.cards.schema import GLOSSARY, LABELS, Direction, Intent, Mention, MetricKey, ToolResult
from buddy.cards.select import select_suppliers
from buddy.cards.thread import card_supplier_lists, user_texts
from buddy.cards.validate import (chose_all, clean_enums, cue_metrics, needs_choice, refers_to_list, resolve_intent,
                                  supplier_ids_in, top_n, wants_all_metrics)

log = logging.getLogger(__name__)

_results_by_invocation: dict[str, dict] = {}  # one card per agent turn, even if the model calls twice


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
        result = _compare(request, intent, direction, mentions, supplier_ids, use_compare_tray, rank_by, rank_order, limit,
                          tool_context)
    except Exception:  # never crash the agent run: a failed card is an answerable error
        log.exception("compare_suppliers failed for request %r", request)
        result = ToolResult(status="error", message="Sorry, I couldn't build that comparison card. Try naming the suppliers "
                                                    "and the metric more explicitly.").model_dump(exclude_none=True)
    if invocation and result["status"] == "ok":
        _results_by_invocation[invocation] = result
    return result


def _compare(request, intent, direction, mentions, supplier_ids, use_compare_tray, rank_by, rank_order, limit,
             tool_context) -> dict:
    said = user_texts(tool_context)  # the buyer's messages in this thread
    latest = said[-1] if said else request
    texts = f"{request}\n{latest}"
    all_metrics = wants_all_metrics(texts)
    take_all = chose_all(latest)  # answered "which one?" with "all of them"

    ms = [m if isinstance(m, dict) else m.model_dump() for m in mentions]
    cues = cue_metrics(texts)
    for m in ms:
        m["metrics"] = clean_enums("compare", "safest", m["metrics"], None)[2]
        narrowed = [k for k in m["metrics"] if k in cues]
        if len(m["metrics"]) > 1 and len(narrowed) == 1:
            m["metrics"] = narrowed  # a clear cue word in the buyer's message settles it: no question
    if all_metrics:
        ms = []  # "all metrics" / "full analysis": everything, never a 23-option question
    for m in ms:  # ambiguity -> the buyer chooses one option (or all of them)
        if not take_all and needs_choice(m["metrics"], request):
            options = [f"{LABELS[k]}: {GLOSSARY[k]}" for k in m["metrics"]] + ["All of them: one panel per option, side by side"]
            return ToolResult(status="needs_clarification",
                              question=f"'{m['phrase']}' can mean different things. Which one should I compare?",
                              options=options).model_dump(exclude_none=True)
    groups = [m["metrics"] for m in ms if m["metrics"]]
    metrics = list(dict.fromkeys(k for g in groups for k in g))
    if not metrics and not all_metrics:
        metrics = cues  # the model missed a clear cue word ("bankrupt"): use the buyer's own words
        groups = [[k] for k in cues]
    intent, direction, metrics, rank_by = clean_enums(intent, direction, metrics, rank_by)
    intent = resolve_intent(intent, metrics)

    ids, sel_error = _suppliers(request, latest, said, supplier_ids, use_compare_tray, rank_by, rank_order, limit, direction,
                                tool_context)
    if sel_error:
        return sel_error

    if all_metrics:
        card = build_all_metrics(direction, ids)
    else:
        panels = panel_groups(groups) if intent == "compare" else [metrics]
        if 1 < len(panels) <= MAX_PANELS:
            card = build_composite(direction, panels, ids)
        else:
            card = build_card(intent, direction, metrics, ids)
    return ToolResult(status="ok", card=card, summary=card["summary"]).model_dump(exclude_none=True)


def _suppliers(request, latest, said, supplier_ids, use_compare_tray, rank_by, rank_order, limit, direction, tool_context):
    """Who to compare. IDs are never invented: they come from the buyer's messages or from a card already shown.

    1. IDs in the request or the buyer's latest message
    2. "these" / "this list" / "the top three of them": the last card's suppliers, in card order
    3. IDs the model passed, if the buyer wrote them earlier in the thread or they were on a card
    4. the compare tray, or a ranking ("the 10 safest by total risk")
    5. nothing said at all, but a card is on screen: that card's suppliers
    """
    cards = card_supplier_lists(tool_context)
    last_card = cards[-1] if cards else []
    grounded = {i for t in said for i in supplier_ids_in(t)} | {i for c in cards for i in c}

    ids = supplier_ids_in(request) or supplier_ids_in(latest)
    if not ids and last_card and (refers_to_list(request) or refers_to_list(latest)):
        n = top_n(latest) or top_n(request)
        ids = last_card[:n] if n else last_card
    if not ids:
        ids = [i for i in dict.fromkeys(supplier_ids or []) if i in grounded]
    tray = (tool_context.state.get("ui") or {}).get("compare_tray", []) if tool_context else []
    sel = select_suppliers(ids, tray, use_compare_tray, rank_by, rank_order, limit, direction)
    if sel.question and last_card:
        sel = select_suppliers(last_card, [], False, None, None, None, direction)
    if sel.question:
        return [], ToolResult(status="needs_clarification", question=sel.question,
                              options=["Name supplier IDs", "The 10 safest by total risk", "The 10 riskiest by total risk"]
                              ).model_dump(exclude_none=True)
    if sel.error:
        return [], ToolResult(status="error", message=sel.error).model_dump(exclude_none=True)
    return sel.ids, None


# What the model needs from a result: never the card itself (the browser gets that from the tool event),
# but its title and supplier IDs, so follow-ups like "compare the top three of these" can name them.
MODEL_FIELDS = ("status", "summary", "question", "options", "message")


def model_view(response: dict) -> dict:
    view = {k: v for k, v in response.items() if k in MODEL_FIELDS}
    card = response.get("card")
    if isinstance(card, dict):
        view["card"] = {"title": card.get("title"), "supplierIDs": [s["supplierID"] for s in card.get("suppliers", [])]}
        if card.get("panels"):
            view["card"]["panels"] = [p["title"] for p in card["panels"]]
    return view


def slim_card_results(callback_context, llm_request):
    """before_model_callback: the model sees `compare_suppliers` results without the card's data.

    Seen live: every card (3-25 KB of JSON) stayed in the thread history, and after ~4 comparisons
    Nemotron started answering with made-up "[ERROR: Max turns (10) exceeded]"-style text. The card is
    only for the browser; the model replies from `summary` and sees the card's title and supplier IDs.
    New objects are built so the stored session
    (and the card the frontend renders) is not modified.
    """
    contents = []
    for content in llm_request.contents:
        parts = content.parts or []
        if not any(p.function_response and p.function_response.name == "compare_suppliers" for p in parts):
            contents.append(content)
            continue
        slim_parts = []
        for p in parts:
            fr = p.function_response
            if fr and fr.name == "compare_suppliers" and isinstance(fr.response, dict):
                slim = model_view(fr.response)
                p = types.Part(function_response=types.FunctionResponse(id=fr.id, name=fr.name, response=slim))
            slim_parts.append(p)
        contents.append(types.Content(role=content.role, parts=slim_parts))
    llm_request.contents = contents
    return None


compare_suppliers.__doc__ = (
    "Build a supplier comparison card and show it on the dashboard. Follow the supplier-comparison-cards skill "
    "procedure to fill the arguments.\n\nMetric glossary (key: meaning):\n"
    + "\n".join(f"- {k}: {v}" for k, v in GLOSSARY.items())
)
