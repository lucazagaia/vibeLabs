"""Deterministic tests — model and search are stubbed; no live API calls."""

from __future__ import annotations

import pytest

import app
import models
import search


class FakeMessage:
    def __init__(self, content: str) -> None:
        self.content = content


class FakeAgent:
    def __init__(self, report: str = "Cited supplier risk findings.") -> None:
        self.report = report
        self.last_payload = None

    def invoke(self, payload):
        self.last_payload = payload
        return {"messages": [FakeMessage(self.report)]}


def test_require_env_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
    with pytest.raises(SystemExit, match="NEBIUS_API_KEY"):
        app.require_env("NEBIUS_API_KEY")


def test_build_model_reads_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NEBIUS_API_KEY", "test-nebius-key")
    monkeypatch.setenv("NEBIUS_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("NEBIUS_ORCHESTRATOR_MODEL", "test/orchestrator")
    monkeypatch.delenv("NEBIUS_MODEL", raising=False)

    captured: dict = {}

    class FakeChatNebius:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(models, "ChatNebius", FakeChatNebius)
    model = app.build_model("orchestrator")
    assert isinstance(model, FakeChatNebius)
    assert captured["api_key"] == "test-nebius-key"
    assert captured["base_url"] == "https://example.test/v1"
    assert captured["model"] == "test/orchestrator"
    # Never leak the key through repr of returned objects in this test path.
    assert "test-nebius-key" not in repr(captured.keys())


def test_build_model_defaults_dual_nemotron(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("NEBIUS_API_KEY", "test-nebius-key")
    monkeypatch.delenv("NEBIUS_ORCHESTRATOR_MODEL", raising=False)
    monkeypatch.delenv("NEBIUS_WORKER_MODEL", raising=False)
    monkeypatch.delenv("NEBIUS_MODEL", raising=False)

    seen: list[str] = []

    class FakeChatNebius:
        def __init__(self, **kwargs):
            seen.append(kwargs["model"])

    monkeypatch.setattr(models, "ChatNebius", FakeChatNebius)
    app.build_model("orchestrator")
    app.build_model("worker")
    assert seen == [
        app.DEFAULT_ORCHESTRATOR_MODEL,
        app.DEFAULT_WORKER_MODEL,
    ]


def test_build_model_legacy_nebius_model_alias(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("NEBIUS_API_KEY", "test-nebius-key")
    monkeypatch.delenv("NEBIUS_ORCHESTRATOR_MODEL", raising=False)
    monkeypatch.setenv("NEBIUS_MODEL", "legacy/orchestrator")

    captured: dict = {}

    class FakeChatNebius:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(models, "ChatNebius", FakeChatNebius)
    app.build_model("orchestrator")
    assert captured["model"] == "legacy/orchestrator"


def test_build_search_tool_requires_tavily(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    with pytest.raises(SystemExit, match="TAVILY_API_KEY"):
        app.build_search_tool()


def test_build_search_tool_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TAVILY_API_KEY", "test-tavily-key")
    captured: dict = {}

    class FakeTavilySearch:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(search, "TavilySearch", FakeTavilySearch)
    tool = app.build_search_tool()
    assert isinstance(tool, FakeTavilySearch)
    assert captured == {
        "max_results": 5,
        "search_depth": "advanced",
        "topic": "general",
    }


def test_extract_final_text_from_messages() -> None:
    result = {"messages": [FakeMessage("hello"), FakeMessage("final report")]}
    assert app.extract_final_text(result) == "final report"


def test_extract_final_text_from_dict_message() -> None:
    result = {"messages": [{"content": "dict report"}]}
    assert app.extract_final_text(result) == "dict report"


def test_run_research_uses_agent() -> None:
    fake = FakeAgent("Lane findings with sources.")
    text = app.run_research("Research Acme Corp", agent=fake)
    assert text == "Lane findings with sources."
    assert fake.last_payload["messages"][0]["content"] == "Research Acme Corp"


def test_main_prints_prefixed_report(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        app,
        "run_research",
        lambda question, agent=None: "Stubbed report body",
    )
    code = app.main(["Research Example Co"])
    captured = capsys.readouterr()
    assert code == 0
    assert captured.out.startswith(app.REPORT_PREFIX + " ")
    assert "Stubbed report body" in captured.out
    # Credentials must never appear even if present in the environment.
    monkeypatch.setenv("NEBIUS_API_KEY", "secret-should-not-print")
    monkeypatch.setenv("TAVILY_API_KEY", "secret-should-not-print")
    assert "secret-should-not-print" not in captured.out


def test_main_default_question(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict = {}

    def fake_run(question, agent=None):
        seen["question"] = question
        return "ok"

    monkeypatch.setattr(app, "run_research", fake_run)
    assert app.main([]) == 0
    assert "Knorr-Bremse" in seen["question"]
