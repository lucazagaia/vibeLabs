"""Generate 8 fixture cards from data/Siemens.csv for building the renderers before the engine exists.

Each fixture is a valid `Card` (buddy/cards/schema.py) and is written to web/components/cards/fixtures/.
Supplier picks are deterministic (fixed IDs or "first N by supplierID that match"), so re-running gives
identical files. Facts, flags and summaries here are simple stand-ins; the real engine (5b) replaces them.

    uv run python scripts/make_fixtures.py
"""

import csv
import hashlib
import json
import statistics as st
import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGENT_DIR))

from buddy.cards.schema import LABELS, VALUE_DIRECTION, Card, MetricKey  # noqa: E402
from buddy.paths import DATA_CSV  # noqa: E402

OUT = AGENT_DIR.parent / "web" / "components" / "cards" / "fixtures"
ROWS = sorted(csv.DictReader(DATA_CSV.open(encoding="utf-8")), key=lambda r: r["supplierID"])
BY_ID = {r["supplierID"]: r for r in ROWS}
RISK_KEYS = [k for k in MetricKey.__args__ if k.endswith("_Score") or k == "Total_Risk_Index"]


def num(row, key):
    v = row[key]
    try:
        return float(v)
    except ValueError:
        return v  # categorical


def first(pred, n):
    return [r["supplierID"] for r in ROWS if pred(r)][:n]


def stats(values):
    vs = sorted(values)
    q1, _, q3 = st.quantiles(vs, n=4)
    iqr = q3 - q1
    return {"min": vs[0], "max": vs[-1], "range": vs[-1] - vs[0], "median": st.median(vs), "q1": q1, "q3": q3, "iqr": iqr,
            "outliers": [v for v in vs if v < q1 - 1.5 * iqr or v > q3 + 1.5 * iqr]}


def flags_for(metric, values):
    if VALUE_DIRECTION[metric] == "categorical":
        return [], "categorical", []
    s = stats(values)
    flags, notes, scale = [], [], "fixed_0_100"
    if metric == "Purchase Order Volume (EUR)":
        scale = "log"
        if s["max"] / max(s["median"], 1) > 5:
            flags.append("skewed_positive")
            notes.append("Spend is heavily skewed; a log scale keeps smaller suppliers readable.")
    elif metric in ("Supplier Delivery Rating", "Order Confirmation Rate", "Order Change Rate"):
        scale = "linear"
    if scale == "fixed_0_100" and s["range"] <= 8:
        flags.append("tight_cluster")
        notes.append(f"All values lie within {s['range']:.0f} points; the metric barely separates this shortlist.")
    if s["outliers"] or s["range"] / max(s["iqr"], 1) > 4:
        flags.append("extreme_outlier")
        notes.append("One supplier sits far from the rest; it is called out so the others stay readable.")
    return flags, scale, notes


def make_card(name, *, renderer, template, title, intent, direction, metrics, ids, sort_desc, quadrants=None):
    sort_field = metrics[0]
    suppliers = []
    for sid in ids:
        r = BY_ID[sid]
        suppliers.append({
            "supplierID": sid,
            "supplierName": r["Supplier Name"],
            "values": {m: num(r, m) for m in metrics},
            "levels": {f"{m}_Level": r[f"{m}_Level"] for m in metrics if f"{m}_Level" in r},
            "flags": [],
        })
    if VALUE_DIRECTION[sort_field] != "categorical":
        suppliers.sort(key=lambda s: s["values"][sort_field], reverse=sort_desc)
    numeric = [m for m in metrics if VALUE_DIRECTION[m] != "categorical"]
    flags, scale, notes = flags_for(metrics[0], [s["values"][metrics[0]] for s in suppliers])
    facts = {}
    if numeric:
        m = numeric[0]
        better_low = VALUE_DIRECTION[m] in ("lower_is_better",)
        ranked = sorted(suppliers, key=lambda s: s["values"][m], reverse=not better_low)
        best, worst = ranked[0], ranked[-1]
        best["flags"].append("best"); worst["flags"].append("worst")
        facts = {"metric": m, "best": {"supplierID": best["supplierID"], "value": best["values"][m]},
                 "worst": {"supplierID": worst["supplierID"], "value": worst["values"][m]},
                 "spread": round(abs(best["values"][m] - worst["values"][m]), 2),
                 "notDiscriminating": "tight_cluster" in flags}
        if VALUE_DIRECTION[m] == "higher_means_more_exposure":
            word = "Highest spend"
            summary = (f"Spend is exposure, not risk. {word}: {worst['supplierID']} (EUR {worst['values'][m]:,.0f}); "
                       f"lowest: {best['supplierID']} (EUR {best['values'][m]:,.0f}).")
        else:
            better = "Lower" if better_low else "Higher"
            summary = (f"{better} is better for {LABELS[m].lower()}. Best: {best['supplierID']} ({best['values'][m]:g}); "
                       f"worst: {worst['supplierID']} ({worst['values'][m]:g}).")
        if facts["notDiscriminating"]:
            summary += " The metric barely separates these suppliers."
    else:
        cells = {}
        for s in suppliers:
            cells.setdefault(f"{s['values'][metrics[0]]} x {s['values'][metrics[1]]}", []).append(s["supplierID"])
        concern = cells.get("High x Complex", [])
        facts = {"grid": cells, "highestConcern": concern}
        summary = (f"{len(concern)} of {len(suppliers)} suppliers are both hard to replace and in a complex supply chain"
                   + (f": {', '.join(concern)}." if concern else "."))
    card = {
        "cardId": hashlib.sha1(json.dumps([template, metrics, ids]).encode()).hexdigest()[:12],
        "renderer": renderer, "template": template, "title": title, "intent": intent, "direction": direction,
        "metrics": metrics, "metricLabels": {m: LABELS[m] for m in metrics},
        "valueDirection": {m: VALUE_DIRECTION[m] for m in metrics},
        "sort": {"field": sort_field, "direction": "desc" if sort_desc else "asc"},
        "dataShape": {"flags": flags, "scale": scale, "fallbackApplied": None, "notes": notes},
        "quadrants": quadrants, "suppliers": suppliers, "facts": facts, "summary": summary,
    }
    Card.model_validate(card)  # fixtures must satisfy the frozen contract
    (OUT / f"{name}.json").write_text(json.dumps(card, indent=2) + "\n")
    print(f"  {name:<34} {renderer:<8} {len(ids):>2} suppliers  flags={flags}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    risk_axes = {"topLeft": "Credit-specific concern", "topRight": "Serious financial concern",
                 "bottomLeft": "Low financial risk", "bottomRight": "Liquidity concern not in credit score"}
    # 1-2: rank
    make_card("01_rank_total_risk", renderer="rank", template="ranked_lollipop_card", title="Total risk",
              intent="compare", direction="safest", metrics=["Total_Risk_Index"],
              ids=[f"SUPP_{i:05d}" for i in (12, 18, 141, 287, 450, 731, 1004, 2410)], sort_desc=False)
    make_card("02_rank_spend_log", renderer="rank", template="log_exposure_bar_card", title="Spend exposure (EUR, log scale)",
              intent="exposure", direction="watch", metrics=["Purchase Order Volume (EUR)"],
              ids=first(lambda r: True, 9) + first(lambda r: float(r["Purchase Order Volume (EUR)"]) >= 40_000_000, 1),
              sort_desc=True)  # include one very large account so the fixture exercises the log scale
    # 3-4: scatter
    make_card("03_scatter_financial_credit", renderer="scatter", template="financial_credit_card",
              title="Financial health vs credit rating", intent="compare", direction="safest",
              metrics=["Financial_Health_Score", "Credit_Rating_Score"], ids=first(lambda r: True, 12), sort_desc=False,
              quadrants={"x": "Financial_Health_Score", "y": "Credit_Rating_Score", "xThreshold": 50, "yThreshold": 50,
                         "labels": risk_axes, "goodZone": "bottomLeft"})
    perf_ids = first(lambda r: True, 15)
    med = lambda k: st.median(float(BY_ID[i][k]) for i in perf_ids)
    make_card("04_scatter_performance", renderer="scatter", template="performance_reliability_card",
              title="Delivery vs order confirmation", intent="compare", direction="safest",
              metrics=["Supplier Delivery Rating", "Order Confirmation Rate", "Order Change Rate"], ids=perf_ids, sort_desc=True,
              quadrants={"x": "Supplier Delivery Rating", "y": "Order Confirmation Rate",
                         "xThreshold": med("Supplier Delivery Rating"), "yThreshold": med("Order Confirmation Rate"),
                         "labels": {"topLeft": "Confirms but delivers late", "topRight": "Reliable",
                                    "bottomLeft": "Weak on both", "bottomRight": "Delivers but confirms slowly"},
                         "goodZone": "topRight"})
    # 5-6: table
    make_card("05_table_overall_benchmark", renderer="table", template="overall_supplier_benchmark_card",
              title="Overall risk benchmark", intent="overview", direction="safest", metrics=RISK_KEYS,
              ids=first(lambda r: True, 10), sort_desc=False)
    make_card("06_table_replaceability_grid", renderer="table", template="replaceability_complexity_card",
              title="Replaceability vs supply chain complexity", intent="compare", direction="watch",
              metrics=["Sourcing Risk Level", "Supply Chain Complexity"], ids=first(lambda r: True, 15), sort_desc=False)
    # 7-8: preflight edge cases (rank renderer)
    make_card("07_edge_tight_cluster", renderer="rank", template="ranked_lollipop_card", title="Total risk (tight cluster)",
              intent="compare", direction="safest", metrics=["Total_Risk_Index"],
              ids=first(lambda r: 50 <= float(r["Total_Risk_Index"]) <= 54, 6), sort_desc=False)
    make_card("08_edge_extreme_outlier", renderer="rank", template="ranked_lollipop_card", title="Total risk (one outlier)",
              intent="compare", direction="safest", metrics=["Total_Risk_Index"],
              ids=first(lambda r: 40 <= float(r["Total_Risk_Index"]) <= 45, 7) + first(lambda r: float(r["Total_Risk_Index"]) >= 90, 1),
              sort_desc=False)


if __name__ == "__main__":
    print(f"Writing fixtures to {OUT.relative_to(AGENT_DIR.parent)}")
    main()
