"""Data-shape preflight (spec section "Data Shape Preflight"): stats, flags, scale and fallbacks.

Only data-level checks live here. Pixel-level checks (point overlap, label collisions) need screen
geometry and belong to the renderers.
"""

import statistics as st

from buddy.cards.route import PO, Route
from buddy.cards.schema import LABELS, VALUE_DIRECTION, DataShape

PERCENT = {"Supplier Delivery Rating", "Order Confirmation Rate", "Order Change Rate"}


def stats(values: list[float]) -> dict:
    vs = sorted(values)
    q1, _, q3 = st.quantiles(vs, n=4) if len(vs) >= 2 else (vs[0], vs[0], vs[0])
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    return {"min": vs[0], "max": vs[-1], "range": vs[-1] - vs[0], "median": st.median(vs), "q1": q1, "q3": q3,
            "iqr": iqr, "unique": len(set(vs)), "low": lo, "high": hi,
            "rangeToIqr": (vs[-1] - vs[0]) / max(iqr, 1), "maxToMedian": vs[-1] / max(st.median(vs), 1)}


def outlier_values(values: list[float]) -> set[float]:
    s = stats(values)
    return {v for v in values if v < s["low"] or v > s["high"]}


def preflight(route: Route, rows: list[dict]) -> tuple[Route, DataShape]:
    m = route.sort_field
    if VALUE_DIRECTION[m] == "categorical":
        return route, DataShape(scale="categorical")
    s = stats([r[m] for r in rows])
    flags, notes = [], list(route.notes)

    # Scale
    if m == PO:
        scale = "log" if s["max"] / max(s["min"], 1) > 3 else "linear"
        if scale == "linear":
            notes.append("Spend values are close together, so a linear scale is used.")
    elif m in PERCENT:
        scale = "linear"
    else:
        scale = "fixed_0_100"

    # Flags
    if m == PO and s["maxToMedian"] > 5:
        flags.append("skewed_positive")
        notes.append("Spend is heavily skewed; the log scale keeps smaller suppliers readable.")
    if scale == "fixed_0_100" and s["range"] <= 8:
        flags.append("tight_cluster")
        notes.append(f"All {LABELS[m].lower()} values lie within {s['range']:.0f} points, so the metric barely separates these suppliers.")
    if s["unique"] <= 3 or (scale == "fixed_0_100" and s["range"] <= 5):
        flags.append("low_variance_metric")
    if outlier_values([r[m] for r in rows]) or s["rangeToIqr"] > 4:
        flags.append("extreme_outlier")
        notes.append("One supplier sits far from the rest and is called out so the others stay readable.")

    # Fallback (spec: a clear table beats a distorted chart)
    fallback = None
    if route.renderer == "rank" and len(route.metrics) == 1 and "low_variance_metric" in flags:
        route = Route("grouped_metric_table_card", "table", route.title, route.metrics, route.sort_field, route.sort_desc,
                      route.quadrants, route.notes)
        fallback = "grouped_metric_table_card"
        notes.append("Values are nearly identical, so a table is shown instead of a chart.")
    return route, DataShape(flags=list(dict.fromkeys(flags)), scale=scale, fallbackApplied=fallback, notes=notes)
