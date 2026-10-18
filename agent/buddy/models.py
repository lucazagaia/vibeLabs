"""Model factory (contract C1): the single place every agent gets its model from.

All agents run Nemotron on Nebius Token Factory through LiteLLM's `nebius/` provider.
Two details matter (see docs/plans/01-model-layer.md):
- LiteLLM still defaults `nebius/` to the legacy Studio URL, so `api_base` is always set.
- LiteLLM drops `reasoning_effort` for Nebius, so it is sent through `extra_body`.
"""

import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from google.adk.models.lite_llm import LiteLlm

load_dotenv(Path(__file__).resolve().parents[1] / ".env")  # agent/.env, independent of cwd

TOKEN_FACTORY_BASE = "https://api.tokenfactory.nebius.com/v1"

Role = Literal["supervisor", "data", "research"]

# role -> (model env var, default model, reasoning env var, default effort)
_ROLES: dict[str, tuple[str, str, str, str]] = {
    "supervisor": ("SUPERVISOR_MODEL", "nebius/nvidia/Nemotron-3_5-Lightning", "SUPERVISOR_REASONING", "low"),
    "data": ("DATA_BUDDY_MODEL", "nebius/nvidia/Nemotron-3_5-Lightning", "DATA_BUDDY_REASONING", "low"),
    "research": ("RESEARCH_BUDDY_MODEL", "nebius/nvidia/nemotron-3-super-120b-a12b", "RESEARCH_BUDDY_REASONING", "medium"),
}


def model_config(role: Role) -> dict:
    """LiteLLM settings for a role, as plain kwargs (shared with the smoke test)."""
    if role not in _ROLES:
        raise ValueError(f"unknown role {role!r}; expected one of {sorted(_ROLES)}")
    model_var, default_model, effort_var, default_effort = _ROLES[role]
    return {
        "model": os.getenv(model_var, default_model),
        "api_base": os.getenv("NEBIUS_API_BASE", TOKEN_FACTORY_BASE),
        "extra_body": {"reasoning_effort": os.getenv(effort_var, default_effort)},
    }


def get_model(role: Role) -> LiteLlm:
    """Return the ADK model for a role. Fails fast if the API key is missing."""
    if not os.getenv("NEBIUS_API_KEY"):
        raise RuntimeError("NEBIUS_API_KEY missing: copy agent/.env.example to agent/.env and add your key")
    return LiteLlm(**model_config(role))
