"""Deterministic decisions on the agent's extracted arguments (plan 05, step 1 of the pipeline)."""

import re
from typing import get_args

from buddy.cards.schema import LABELS, Direction, Intent, MetricKey

INTENTS, DIRECTIONS, METRICS = set(get_args(Intent)), set(get_args(Direction)), set(get_args(MetricKey))
# Values the model has been seen to put in the wrong field (e.g. intent="watch").
INTENT_ALIASES = {"watch": "watchlist", "red_flags": "watchlist", "overall": "overview", "general": "overview",
                  "pick": "choose", "decide": "choose", "spend": "exposure"}

SUPPLIER_ID = re.compile(r"SUPP_\d{5}")

# Words that name exactly one metric (the skill's "clear examples"). Seen live: for "least likely to go
# bankrupt" the model sometimes listed both financial metrics, or none. A cue in the buyer's own words decides.
CLEAR_CUES: dict[str, re.Pattern] = {
    "Financial_Health_Score": re.compile(r"bankrupt|insolven|go(?:es|ing)? under", re.I),
    "Credit_Rating_Score": re.compile(r"credit ?rating|creditworth", re.I),
    "Supplier Delivery Rating": re.compile(r"on[- ]time|deliver\w* late|late deliver", re.I),
    "Order Change Rate": re.compile(r"chang\w* (?:our |the )?orders?", re.I),
    "Digital_Security_Score": re.compile(r"hack|cyber", re.I),
    "Sub_Tier_Visibility_Score": re.compile(r"sub-?suppliers?|sub-?tier", re.I),
}


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


def resolve_intent(intent: str, metrics: list[str]) -> str:
    """Metrics decide, not the agent's intent label, wherever the two conflict.

    - compare with no metric -> general comparison -> the spec's overall benchmark card (not a question)
    - choose with a named metric ("which has the best credit rating") -> rank on that metric (compare)
    """
    if intent == "compare" and not metrics:
        return "overview"
    if intent == "choose" and metrics:
        return "compare"
    return intent


def supplier_ids_in(request: str) -> list[str]:
    """IDs are taken from the buyer's verbatim message only; model-supplied IDs not in it are dropped."""
    return list(dict.fromkeys(SUPPLIER_ID.findall(request)))


def clean_enums(intent: str, direction: str, metrics: list[str], rank_by: str | None) -> tuple[str, str, list[str], str | None]:
    """The tool schema lists the enums, but the model doesn't always respect them: normalise instead of failing."""
    intent = intent if intent in INTENTS else INTENT_ALIASES.get(str(intent).lower(), "compare")
    direction = direction if direction in DIRECTIONS else ("watch" if "watch" in str(direction).lower() else "safest")
    metrics = [m for m in metrics if m in METRICS]
    rank_by = rank_by if rank_by in METRICS else None
    return intent, direction, metrics, rank_by


def cue_metrics(request: str) -> list[str]:
    """Metrics the buyer named with an unambiguous cue word, in CLEAR_CUES order."""
    return [k for k, pattern in CLEAR_CUES.items() if pattern.search(request)]
