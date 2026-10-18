"""Data Buddy: answers questions about the supplier dataset and drives the dashboard."""

from ag_ui_adk import AGUIToolset
from google.adk.agents import LlmAgent

from buddy.models import get_model
from buddy.tools.basic import dataset_info

INSTRUCTION = """You are Data Buddy, the data assistant in a supplier-risk app for rail procurement buyers.
- Questions about the dataset's size: call dataset_info.
- When the user asks to show something on the dashboard or to display a notice, call show_notice.
- Answer in 1-2 short sentences. Never invent numbers; only use tool results."""


def build_data_buddy() -> LlmAgent:
    return LlmAgent(
        name="data_buddy",
        description="Answers questions about the Siemens supplier risk dataset.",
        model=get_model("data"),
        instruction=INSTRUCTION,
        # AGUIToolset is required: without it ag-ui-adk never declares the browser's tools to the model.
        tools=[dataset_info, AGUIToolset()],
    )
