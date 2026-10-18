"""File locations, resolved from this file so they work from any working directory."""

from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = AGENT_DIR.parent
DATA_CSV = REPO_DIR / "data" / "Siemens.csv"
