"""NemotronLlm retry: scripted model streams, no API key or network needed."""

import asyncio

from google.adk.models.lite_llm import LiteLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types

from buddy.models import APOLOGY, NemotronLlm


def text(t: str, partial: bool = True, thought: bool = False) -> LlmResponse:
    return LlmResponse(content=types.Content(role="model", parts=[types.Part(text=t, thought=thought or None)]), partial=partial)


def call(name: str) -> LlmResponse:
    return LlmResponse(content=types.Content(role="model", parts=[types.Part(function_call=types.FunctionCall(name=name, args={}))]))


RAW = [text("<tool"), text("_call>\n<function=load_skill>\n</name>"), text("<tool_call>\n<function=load_skill>\n</name>", partial=False)]


def run(monkeypatch, scripts: list[list[LlmResponse]], stream: bool = True) -> tuple[list[LlmResponse], int]:
    calls = []

    async def fake(self, llm_request, stream=False):
        calls.append(1)
        for r in scripts[len(calls) - 1]:
            yield r

    monkeypatch.setattr(LiteLlm, "generate_content_async", fake)
    model = NemotronLlm(model="nebius/test")

    async def collect():
        return [r async for r in model.generate_content_async(LlmRequest(), stream=stream)]

    return asyncio.run(collect()), len(calls)


def texts(responses):
    return [p.text if p.text else f"call:{p.function_call.name}" for r in responses for p in r.content.parts]


def test_raw_tool_call_is_hidden_and_retried(monkeypatch):
    out, n = run(monkeypatch, [[text("thinking", thought=True), *RAW], [call("load_skill")]])
    assert n == 2
    assert texts(out) == ["thinking", "call:load_skill"]  # reasoning passes, the raw markup never does


def test_normal_text_streams_untouched(monkeypatch):
    script = [text("<"), text("b>Hi"), text(" there"), text("<b>Hi there", partial=False)]
    out, n = run(monkeypatch, [script])
    assert n == 1 and out == script  # "<" is held only until "<b" rules out "<tool_call>"


def test_raw_twice_gives_apology(monkeypatch):
    out, n = run(monkeypatch, [RAW, RAW])
    assert n == 2 and texts(out) == [APOLOGY]


def test_non_streaming_raw_is_retried(monkeypatch):
    out, n = run(monkeypatch, [[RAW[-1]], [text("Done.", partial=False)]], stream=False)
    assert n == 2 and texts(out) == ["Done."]
