"""Generate 10 fixture cards from data/Siemens.csv with the real card engine (buddy.cards.tool.build_card).

Each fixture is exactly what `compare_suppliers` sends the frontend and is written to
web/components/cards/fixtures/. Supplier picks are deterministic (fixed IDs or "first N by supplierID
that match"), so re-running gives identical files.

    uv run python scripts/make_fixtures.py
"""

import csv
import json
import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGENT_DIR))

from buddy.paths import DATA_CSV  # noqa: E402

OUT = AGENT_DIR.parent / "web" / "components" / "cards" / "fixtures"
ROWS = sorted(csv.DictReader(DATA_CSV.open(encoding="utf-8")), key=lambda r: r["supplierID"])


def first(pred, n):
    return [r["supplierID"] for r in ROWS if pred(r)][:n]


def main():
    from buddy.cards.tool import build_card

    OUT.mkdir(parents=True, exist_ok=True)
    spend_ids = first(lambda r: True, 9) + first(lambda r: float(r["Purchase Order Volume (EUR)"]) >= 40_000_000, 1)
    specs = [
        ("01_rank_total_risk", "compare", "safest", ["Total_Risk_Index"],
         [f"SUPP_{i:05d}" for i in (12, 18, 141, 287, 450, 731, 1004, 2410)]),
        ("02_rank_spend_log", "compare", "safest", ["Purchase Order Volume (EUR)"], spend_ids),
        ("03_scatter_financial_credit", "compare", "safest", ["Financial_Health_Score", "Credit_Rating_Score"], first(lambda r: True, 12)),
        ("04_scatter_performance", "compare", "safest", ["Supplier Delivery Rating", "Order Confirmation Rate", "Order Change Rate"],
         first(lambda r: True, 15)),
        ("05_table_overall_benchmark", "overview", "safest", [], first(lambda r: True, 10)),
        ("06_table_replaceability_grid", "compare", "watch", ["Sourcing Risk Level", "Supply Chain Complexity"], first(lambda r: True, 15)),
        ("07_edge_tight_cluster", "compare", "safest", ["Total_Risk_Index"], first(lambda r: 50 <= float(r["Total_Risk_Index"]) <= 54, 6)),
        ("08_edge_extreme_outlier", "compare", "safest", ["Total_Risk_Index"],
         first(lambda r: 40 <= float(r["Total_Risk_Index"]) <= 45, 7) + first(lambda r: float(r["Total_Risk_Index"]) >= 90, 1)),
        ("09_rank_esg_cluster", "compare", "safest", ["ESG_Performance_Score", "Labor_Stability_Score", "Safety_Incident_Score"],
         first(lambda r: True, 8)),
        ("10_table_hidden_outliers", "watchlist", "watch", [],
         first(lambda r: r["Total_Risk_Index_Level"] in ("Low", "Medium") and r["Geopolitical_Risk_Score_Level"] == "Critical", 4)
         + first(lambda r: True, 4)),
    ]
    for name, intent, direction, metrics, ids in specs:
        card = build_card(intent, direction, metrics, ids)
        (OUT / f"{name}.json").write_text(json.dumps(card, indent=2) + "\n")
        print(f"  {name:<30} {card['renderer']:<8} {card['template']:<32} {len(ids):>2} suppliers  flags={card['dataShape']['flags']}")


if __name__ == "__main__":
    print(f"Writing fixtures to {OUT.relative_to(AGENT_DIR.parent)}")
    main()
