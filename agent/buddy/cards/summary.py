"""2-3 sentence summary written by code from `facts` (the agent only relays it)."""

from buddy.cards.route import PO, TRI
from buddy.cards.schema import LABELS, VALUE_DIRECTION


def fmt(metric: str, value: float) -> str:
    if metric == PO:
        return f"EUR {value:,.0f}"
    if VALUE_DIRECTION[metric] in ("higher_is_better",) or metric == "Order Change Rate":
        return f"{value:.1f}%"
    return f"{value:g}"


def _better(metric: str) -> str:
    vd = VALUE_DIRECTION[metric]
    return {"lower_is_better": "Lower is better", "higher_is_better": "Higher is better"}.get(vd, "")


def _hidden(facts: dict) -> str:
    h = facts.get("hiddenWatchouts") or []
    if not h:
        return ""
    first = h[0]
    more = f" (+{len(h) - 1} more)" if len(h) > 1 else ""
    return (f" Watch: {first['supplierID']} looks moderate overall (total risk {first['totalRisk']:g}) but has critical "
            f"{LABELS[first['metric']].lower()} ({first['value']:g}){more}.")


def write(card: dict) -> str:
    f, t, m = card["facts"], card["template"], card["sort"]["field"]
    notes = " ".join(n for n in card["dataShape"]["notes"] if "barely separates" in n or "nearly identical" in n)

    if t == "replaceability_complexity_card":
        c = f["highestConcern"]
        return (f"{len(c)} of {len(card['suppliers'])} suppliers are both hard to replace and in a complex supply chain"
                + (f": {', '.join(c)}." if c else "."))
    if t == "hidden_outlier_card":
        h = f["hiddenWatchouts"]
        if not h:
            return "None of these suppliers hides a critical geopolitical, political or environmental risk behind its total risk."
        return f"{len(h)} supplier(s) hide a critical external risk behind moderate total risk." + _hidden(f)
    if t == "shortlist_decision_card":
        watch = ", ".join(LABELS[k].lower() for k in f["recommendedWatchouts"])
        s = f"Recommended: {f['recommended']}, the lowest total risk among suppliers without a critical score in the focus metrics."
        if f.get("runnerUp"):
            s += f" Runner-up: {f['runnerUp']}."
        if watch:
            s += f" Keep an eye on its {watch}."
        return s + _hidden(f)
    if t == "overall_supplier_benchmark_card":
        return (f"Safest overall: {f['safestOverall']}; riskiest overall: {f['riskiestOverall']}. "
                f"Largest spend: {f['largestExposure']}; weakest delivery: {f['weakestDelivery']}." + _hidden(f))
    if "worstAverage" in f and card["renderer"] in ("table", "rank") and len(card["metrics"]) > 1:
        w, sp = f["worstAverage"], f["biggestSpike"]
        return (f"Lower is better. Worst on average across these metrics: {w['supplierID']} ({w['value']:g}). "
                f"Biggest single spike: {sp['supplierID']} on {LABELS[sp['metric']].lower()} ({sp['value']:g})." + _hidden(f))

    best, worst = f["best"], f["worst"]
    if m == PO:
        s = (f"Spend is exposure, not risk. Largest: {worst['supplierID']} ({fmt(m, worst['value'])}); "
             f"smallest: {best['supplierID']} ({fmt(m, best['value'])}).")
    else:
        s = (f"{_better(m)} for {LABELS[m].lower()}. Best: {best['supplierID']} ({fmt(m, best['value'])}); "
             f"worst: {worst['supplierID']} ({fmt(m, worst['value'])}).")
    if "quadrant" in f:
        q = f["quadrant"]
        zone = q["inConcernZone"]
        s += (f" In the '{q['concernLabel']}' zone: {', '.join(zone[:4])}{' and others' if len(zone) > 4 else ''}."
              if zone else f" No supplier is in the '{q['concernLabel']}' zone.")
    if notes:
        s += " " + notes
    return s + _hidden(f)
