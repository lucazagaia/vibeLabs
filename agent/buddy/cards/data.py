"""Read-only access to data/Siemens.csv, loaded once per process."""

import csv
from functools import lru_cache

from buddy.cards.schema import VALUE_DIRECTION
from buddy.paths import DATA_CSV


def _parse(row: dict) -> dict:
    out = dict(row)
    for key, direction in VALUE_DIRECTION.items():
        if direction != "categorical":
            out[key] = float(row[key])
    return out


@lru_cache(maxsize=1)
def rows() -> tuple[dict, ...]:
    with DATA_CSV.open(newline="", encoding="utf-8") as f:
        return tuple(_parse(r) for r in csv.DictReader(f))


@lru_cache(maxsize=1)
def by_id() -> dict[str, dict]:
    return {r["supplierID"]: r for r in rows()}
