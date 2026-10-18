"""Minimal ADK agent on Nemotron: proves get_model() and tool calling end to end.

    cd agent && uv run adk run scripts/adk_hello
    > how many suppliers do we have?
"""

import csv
import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = AGENT_DIR.parent
sys.path.insert(0, str(AGENT_DIR))  # `adk run` does not put agent/ on sys.path

from google.adk.agents import LlmAgent  # noqa: E402

from buddy.models import get_model  # noqa: E402

# The CSV moves to data/ in Step 2; accept both locations until then.
_CSV_CANDIDATES = (REPO_DIR / "data" / "Siemens.csv", REPO_DIR / "Siemens.csv")


def dataset_info() -> dict:
    """Return the number of suppliers (rows) and columns in the Siemens supplier risk dataset."""
    path = next((p for p in _CSV_CANDIDATES if p.exists()), None)
    if path is None:
        return {"error": "Siemens.csv not found"}
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = sum(1 for _ in reader)
    return {"rows": rows, "columns": len(header)}


root_agent = LlmAgent(
    name="hello",
    model=get_model("supervisor"),
    instruction=(
        "You are Buddy, a concise assistant for a supplier risk dataset. "
        "When asked about the size of the dataset, call the dataset_info tool and answer in one sentence."
    ),
    tools=[dataset_info],
)
