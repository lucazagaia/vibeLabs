"""Minimal ADK agent on Nemotron: proves get_model() and tool calling end to end.

    cd agent && uv run adk run scripts/adk_hello
    > how many suppliers do we have?
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # `adk run` does not put agent/ on sys.path

from google.adk.agents import LlmAgent  # noqa: E402

from buddy.models import get_model  # noqa: E402
from buddy.tools.basic import dataset_info  # noqa: E402

root_agent = LlmAgent(
    name="hello",
    model=get_model("supervisor"),
    instruction=(
        "You are Buddy, a concise assistant for a supplier risk dataset. "
        "When asked about the size of the dataset, call the dataset_info tool and answer in one sentence."
    ),
    tools=[dataset_info],
)
