"""Supplier selection: explicit IDs, the compare tray, or a ranking criterion. Always 2-20 suppliers."""

from dataclasses import dataclass

from buddy.cards import data
from buddy.cards.schema import LABELS, VALUE_DIRECTION

MAX_SUPPLIERS = 20
DEFAULT_LIMIT = 10


@dataclass
class Selection:
    ids: list[str]
    reason: str
    question: str | None = None  # set -> needs_clarification
    error: str | None = None  # set -> error


def _rank(metric: str, order: str, limit: int) -> list[str]:
    reverse = order == "highest"
    ranked = sorted(data.rows(), key=lambda r: (r[metric], r["supplierID"]), reverse=reverse)
    return [r["supplierID"] for r in ranked[:limit]]


def select_suppliers(
    request_ids: list[str],
    tray_ids: list[str],
    use_compare_tray: bool,
    rank_by: str | None,
    rank_order: str | None,
    limit: int | None,
    direction: str,
) -> Selection:
    known = data.by_id()
    if request_ids:
        unknown = [i for i in request_ids if i not in known]
        if unknown:
            return Selection([], "", error=f"These supplier IDs are not in the dataset: {', '.join(unknown)}.")
        ids, reason = request_ids, "IDs named in the request"
    elif use_compare_tray or (tray_ids and not rank_by):
        if not tray_ids:
            return Selection([], "", question="Which suppliers should I compare? Name their IDs (e.g. SUPP_00012) or a "
                                              "criterion such as 'the 10 safest by total risk'.")
        ids, reason = [i for i in tray_ids if i in known], "suppliers in your compare tray"
    elif rank_by:
        if VALUE_DIRECTION.get(rank_by) == "categorical":
            return Selection([], "", error=f"I can't rank by {LABELS[rank_by].lower()} because it is a category.")
        better_low = VALUE_DIRECTION[rank_by] == "lower_is_better"
        order = rank_order or ("lowest" if (direction == "safest") == better_low else "highest")
        n = max(2, min(limit or DEFAULT_LIMIT, MAX_SUPPLIERS))
        ids, reason = _rank(rank_by, order, n), f"{n} suppliers with the {order} {LABELS[rank_by].lower()}"
    else:
        return Selection([], "", question="Which suppliers should I compare? Name their IDs (e.g. SUPP_00012) or a "
                                          "criterion such as 'the 10 safest by total risk'.")
    if len(ids) > MAX_SUPPLIERS:  # keep the 20 safest (or riskiest for watch) by total risk
        ranked = sorted(ids, key=lambda i: known[i]["Total_Risk_Index"], reverse=direction == "watch")
        ids, reason = ranked[:MAX_SUPPLIERS], reason + f", narrowed to {MAX_SUPPLIERS} by total risk"
    if len(ids) < 2:
        return Selection([], "", error="A comparison needs at least 2 suppliers.")
    return Selection(ids, reason)
