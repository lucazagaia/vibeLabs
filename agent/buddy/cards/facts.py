"""Facts: everything the summary may say, computed from the data (spec "Interpretation Rules")."""

import statistics as st

from buddy.cards.preflight import outlier_values
from buddy.cards.route import CONF, DEL, PO, SCC, SRC, TRI, Route
from buddy.cards.schema import VALUE_DIRECTION

EXTERNAL = ["Geopolitical_Risk_Score", "Political_Stability_Score", "Environmental_Exposure_Score"]
OPPOSITE = {"topLeft": "bottomRight", "topRight": "bottomLeft", "bottomLeft": "topRight", "bottomRight": "topLeft"}


def _better_low(metric: str) -> bool:
    return VALUE_DIRECTION[metric] == "lower_is_better"


def _quadrant(row: dict, q: dict) -> str:
    top = row[q["y"]] >= q["yThreshold"]
    right = row[q["x"]] >= q["xThreshold"]
    return ("top" if top else "bottom") + ("Right" if right else "Left")


def hidden_watchouts(rows: list[dict]) -> list[dict]:
    """Low/Medium total risk but a Critical geopolitical, political or environmental score (spec: hidden_outlier)."""
    out = []
    for r in rows:
        if r[f"{TRI}_Level"] in ("Low", "Medium"):
            crit = [(k, r[k]) for k in EXTERNAL if r[f"{k}_Level"] == "Critical"]
            if crit:
                k, v = max(crit, key=lambda kv: kv[1])
                out.append({"supplierID": r["supplierID"], "totalRisk": r[TRI], "metric": k, "value": v})
    return out


def compute(route: Route, rows: list[dict]) -> tuple[dict, dict[str, list[str]]]:
    """Returns (facts, per-supplier flags)."""
    flags: dict[str, list[str]] = {r["supplierID"]: [] for r in rows}
    facts: dict = {"template": route.template}
    m = route.sort_field

    if VALUE_DIRECTION[m] != "categorical":
        if VALUE_DIRECTION[m] == "higher_means_more_exposure":
            ranked = sorted(rows, key=lambda r: r[m], reverse=True)  # "worst" = largest exposure
            best, worst = ranked[-1], ranked[0]
        else:
            ranked = sorted(rows, key=lambda r: r[m], reverse=not _better_low(m))
            best, worst = ranked[0], ranked[-1]
        facts.update(metric=m, best={"supplierID": best["supplierID"], "value": best[m]},
                     worst={"supplierID": worst["supplierID"], "value": worst[m]},
                     spread=round(abs(best[m] - worst[m]), 2))
        flags[best["supplierID"]].append("best")
        flags[worst["supplierID"]].append("worst")
        for r in rows:
            if r[m] in outlier_values([x[m] for x in rows]):
                flags[r["supplierID"]].append("outlier")

    hidden = hidden_watchouts(rows)
    facts["hiddenWatchouts"] = hidden
    for h in hidden:
        flags[h["supplierID"]].append("hidden_watchout")

    if route.quadrants:
        q = route.quadrants
        concern = OPPOSITE[q["goodZone"]]
        facts["quadrant"] = {"concernZone": concern, "concernLabel": q["labels"][concern],
                             "inConcernZone": [r["supplierID"] for r in rows if _quadrant(r, q) == concern],
                             "inGoodZone": [r["supplierID"] for r in rows if _quadrant(r, q) == q["goodZone"]]}

    if route.template in ("overall_supplier_benchmark_card", "shortlist_decision_card"):
        facts["safestOverall"] = min(rows, key=lambda r: r[TRI])["supplierID"]
        facts["riskiestOverall"] = max(rows, key=lambda r: r[TRI])["supplierID"]
        facts["largestExposure"] = max(rows, key=lambda r: r[PO])["supplierID"]
        facts["weakestDelivery"] = min(rows, key=lambda r: r[DEL])["supplierID"]
    if route.template == "shortlist_decision_card":
        focus = [k for k in route.metrics if VALUE_DIRECTION[k] == "lower_is_better"]
        clean = [r for r in rows if not any(r.get(f"{k}_Level") == "Critical" for k in focus)] or list(rows)
        ranked = sorted(clean, key=lambda r: (r[TRI], -r[DEL], r["supplierID"]))
        rec = ranked[0]
        facts["recommended"] = rec["supplierID"]
        facts["runnerUp"] = ranked[1]["supplierID"] if len(ranked) > 1 else None
        facts["recommendedWatchouts"] = [k for k in focus if rec.get(f"{k}_Level") in ("High", "Critical")]
        flags[rec["supplierID"]].append("recommended")
    if route.template in ("risk_heatmap_matrix_card", "operational_chain_card", "esg_workforce_card",
                          "reputation_cluster_card", "geopolitical_external_card", "outlier_watchlist_card"):
        risk = [k for k in route.metrics if VALUE_DIRECTION[k] == "lower_is_better"]
        if risk:
            avg = {r["supplierID"]: st.mean(r[k] for k in risk) for r in rows}
            worst_id = max(avg, key=avg.get)
            spike = max(((r["supplierID"], k, r[k]) for r in rows for k in risk), key=lambda t: t[2])
            facts["worstAverage"] = {"supplierID": worst_id, "value": round(avg[worst_id], 1), "metrics": risk}
            facts["biggestSpike"] = {"supplierID": spike[0], "metric": spike[1], "value": spike[2]}
    if route.template == "replaceability_complexity_card":
        grid: dict[str, list[str]] = {}
        for r in rows:
            grid.setdefault(f"{r[SRC]} x {r[SCC]}", []).append(r["supplierID"])
        facts["grid"] = grid
        facts["highestConcern"] = grid.get("High x Complex", [])
    if route.template == "performance_reliability_card":
        facts["highestChangeRate"] = max(rows, key=lambda r: r["Order Change Rate"])["supplierID"]
    return facts, flags
