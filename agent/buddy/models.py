"""Model factory (contract C1): the single place every agent gets its model from.

All agents run Nemotron on Nebius Token Factory through LiteLLM's `nebius/` provider.
Two details matter (see docs/plans/01-model-layer.md):
- LiteLLM still defaults `nebius/` to the legacy Studio URL, so `api_base` is always set.
- LiteLLM drops `reasoning_effort` for Nebius, so it is sent through `extra_body`.
Nemotron sometimes writes a tool call as plain text; `NemotronLlm` retries once (docs/plans/05c-card-integration.md).
"""

import logging
import os
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from google.adk.models.lite_llm import LiteLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types

load_dotenv(Path(__file__).resolve().parents[1] / ".env")  # agent/.env, independent of cwd

TOKEN_FACTORY_BASE = "https://api.tokenfactory.nebius.com/v1"
RAW_TOOL_CALL = "<tool_call>"
APOLOGY = "Sorry, I couldn't finish that. Please ask again."

log = logging.getLogger(__name__)

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


def _visible_text(response: LlmResponse) -> str:
    """Answer text only: reasoning (thought) parts and function calls don't count."""
    parts = response.content.parts if response.content and response.content.parts else []
    return "".join(p.text for p in parts if p.text and not p.thought)


class NemotronLlm(LiteLlm):
    """LiteLlm, plus one retry when Nemotron writes a tool call as text instead of calling it.

    Seen live: the reply was `<tool_call><function=load_skill>...` as plain text, so no tool ran.
    Answer text is streamed to the chat as it arrives, so it is held back only while it could
    still be the start of `<tool_call>`: a normal reply is released at its first character.
    Reasoning and real function-call chunks are never held.
    """

    async def generate_content_async(self, llm_request: LlmRequest, stream: bool = False) -> AsyncGenerator[LlmResponse, None]:
        for attempt in (1, 2):
            held: list[LlmResponse] = []
            seen, decided, raw = "", False, False
            responses = super().generate_content_async(llm_request, stream)
            try:
                async for response in responses:
                    text = _visible_text(response)
                    if decided or not text:
                        yield response
                        continue
                    # Partials carry deltas; a final (non-partial) response carries the whole text.
                    head = (seen + text if response.partial else text).lstrip()
                    if response.partial:
                        seen += text
                    if head.startswith(RAW_TOOL_CALL):
                        raw = True
                        break
                    if response.partial and RAW_TOOL_CALL.startswith(head):
                        held.append(response)  # still could become "<tool_call>": wait for more
                        continue
                    decided = True
                    for h in held:
                        yield h
                    held.clear()
                    yield response
            finally:
                await responses.aclose()
            if not raw:
                for h in held:  # stream ended while undecided (e.g. a lone "<"): nothing to hide
                    yield h
                return
            log.warning("model %s wrote a tool call as text (attempt %d)%s", self.model, attempt,
                        ", retrying" if attempt == 1 else ", giving up")
        yield LlmResponse(content=types.Content(role="model", parts=[types.Part(text=APOLOGY)]))


def get_model(role: Role) -> LiteLlm:
    """Return the ADK model for a role. Fails fast if the API key is missing."""
    if not os.getenv("NEBIUS_API_KEY"):
        raise RuntimeError("NEBIUS_API_KEY missing: copy agent/.env.example to agent/.env and add your key")
    return NemotronLlm(**model_config(role))
