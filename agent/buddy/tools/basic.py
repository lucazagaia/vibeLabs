"""Skeleton backend tools (contract C4)."""

import csv

from buddy.paths import DATA_CSV


def dataset_info() -> dict:
    """Return the number of suppliers (rows) and columns in the Siemens supplier risk dataset."""
    if not DATA_CSV.exists():
        return {"error": f"dataset not found at {DATA_CSV.name}"}
    with DATA_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = sum(1 for _ in reader)
    return {"rows": rows, "columns": len(header)}
