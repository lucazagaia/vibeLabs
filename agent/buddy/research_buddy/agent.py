"""Research Buddy: stub until the research pipeline exists. Proves the Data/Research switch."""

from ag_ui_adk import AGUIToolset
from google.adk.agents import LlmAgent

from buddy.models import get_model

INSTRUCTION = """You are Research Buddy, the research assistant in a supplier-risk app for rail procurement buyers.
Your web research tools are not connected yet. Introduce yourself as Research Buddy, say that you will soon
research real companies (news, public sources, red flags) and produce a risk report with source links,
and answer briefly in 1-2 sentences. Do not make up research findings."""


def build_research_buddy() -> LlmAgent:
    return LlmAgent(
        name="research_buddy",
        description="Researches real companies for supplier risk (stub).",
        model=get_model("research"),
        instruction=INSTRUCTION,
        tools=[AGUIToolset()],
    )
