"""Deterministic decisions on the agent's extracted arguments (plan 05, step 1 of the pipeline).

Only the ambiguity and intent rules so far (5a); supplier/enum validation is added in 5b.
"""

import re

from buddy.cards.schema import LABELS

SUPPLIER_ID = re.compile(r"SUPP_\d{5}")


def _name_terms(metric: str) -> str:
    """Plain name a buyer would write, e.g. 'Credit rating' -> 'credit rating', 'Spend (PO volume, EUR)' -> 'spend'."""
    return LABELS[metric].split("(")[0].strip().lower()


def named_explicitly(metric: str, request: str) -> bool:
    return _name_terms(metric) in request.lower()


def needs_choice(mention_metrics: list[str], request: str) -> bool:
    """A mention is ambiguous if it has several candidates the buyer did not each name explicitly.

    'financial risk' -> [Financial health, Credit rating]: neither name is in the request -> ask.
    'financial health and credit rating' -> both names are in the request -> explicit list, no question.
    """
    if len(mention_metrics) <= 1:
        return False
    return not all(named_explicitly(m, request) for m in mention_metrics)


def resolve_intent(intent: str, mentions: list) -> str:
    """No topic mentioned -> general comparison -> the spec's overall benchmark card (not a question)."""
    if intent == "compare" and not mentions:
        return "overview"
    return intent


def supplier_ids_in(request: str) -> list[str]:
    """IDs are taken from the buyer's verbatim message only; model-supplied IDs not in it are dropped."""
    return list(dict.fromkeys(SUPPLIER_ID.findall(request)))
