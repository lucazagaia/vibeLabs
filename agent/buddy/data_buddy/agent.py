"""Data Buddy: answers questions about the supplier dataset and drives the dashboard."""

from pathlib import Path

from ag_ui_adk import AGUIToolset
from google.adk.agents import LlmAgent
from google.adk.skills import load_skill_from_dir
from google.adk.tools.skill_toolset import SkillDiscoveryMode, SkillToolset

from buddy.cards.tool import compare_suppliers, slim_card_results
from buddy.models import get_model
from buddy.tools.basic import dataset_info

SKILLS_DIR = Path(__file__).resolve().parents[1] / "skills"


def hide_notice_unless_asked(callback_context, llm_request):
    """`show_notice` reaches the model only when the buyer's message asks for a notice.

    Seen in the browser: after a comparison, the model called show_notice anyway, which re-ran the agent
    and repeated its reply. Code decides, not the model. (AGUIToolset's tool_filter can't do this: ag-ui-adk
    calls it without the run context, so it never sees the message.)
    """
    content = callback_context.user_content
    text = " ".join(p.text or "" for p in (content.parts or [])) if content else ""
    if "notice" in text.lower():
        return None
    llm_request.tools_dict.pop("show_notice", None)
    for tool in llm_request.config.tools or []:
        if getattr(tool, "function_declarations", None):
            tool.function_declarations = [d for d in tool.function_declarations if d.name != "show_notice"]
    return None


INSTRUCTION = """You are Data Buddy, the data assistant in a supplier-risk app for rail procurement buyers.
- Comparing, ranking, shortlisting or choosing between suppliers: use the supplier-comparison-cards skill.
- Only when the buyer asks how many suppliers or columns the dataset has: call dataset_info.
- Only when the buyer explicitly asks for a notice: call show_notice (it is offered only then).
  Comparison cards appear on the dashboard by themselves.
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
        before_model_callback=[hide_notice_unless_asked, slim_card_results],
    )
