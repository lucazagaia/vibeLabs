"""Data Buddy: answers questions about the supplier dataset and drives the dashboard."""

from pathlib import Path

from ag_ui_adk import AGUIToolset
from google.adk.agents import LlmAgent
from google.adk.skills import load_skill_from_dir
from google.adk.tools.skill_toolset import SkillDiscoveryMode, SkillToolset

from buddy.cards.tool import compare_suppliers
from buddy.models import get_model
from buddy.tools.basic import dataset_info

SKILLS_DIR = Path(__file__).resolve().parents[1] / "skills"

INSTRUCTION = """You are Data Buddy, the data assistant in a supplier-risk app for rail procurement buyers.
- Comparing, ranking, shortlisting or choosing between suppliers: use the supplier-comparison-cards skill.
- Only when the buyer asks how many suppliers or columns the dataset has: call dataset_info.
- Only when the buyer explicitly asks for a notice: call show_notice. Comparison cards appear on the
  dashboard by themselves; never call show_notice for them.
- Answer in 1-2 short sentences. Never invent numbers; only use tool results."""


def build_data_buddy() -> LlmAgent:
    comparison_cards = SkillToolset(
        skills=[load_skill_from_dir(SKILLS_DIR / "supplier-comparison-cards")],
        additional_tools=[compare_suppliers],  # declared to the model only after load_skill
        discovery_mode=SkillDiscoveryMode.EAGER,  # skill catalog in the system prompt: no list_skills turn
    )
    return LlmAgent(
        name="data_buddy",
        description="Answers questions about the Siemens supplier risk dataset.",
        model=get_model("data"),
        instruction=INSTRUCTION,
        # AGUIToolset is required: without it ag-ui-adk never declares the browser's tools to the model.
        tools=[dataset_info, comparison_cards, AGUIToolset()],
    )
