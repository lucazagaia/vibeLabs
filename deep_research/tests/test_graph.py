from types import SimpleNamespace

from research_graph import ResearchRuntime, initial_state


class ScriptedModel:
    def __init__(self, responder) -> None:
        self.responder = responder
        self.calls = 0

    def invoke(self, messages):
        self.calls += 1
        content = messages[-1]["content"] if isinstance(messages[-1], dict) else messages[-1].content
        return SimpleNamespace(content=self.responder(content))


class RecordingSearch:
    def __init__(self) -> None:
        self.queries: list[str] = []

    def invoke(self, payload):
        self.queries.append(payload["query"])
        return {
            "results": [
                {
                    "title": "Acme source",
                    "url": "https://example.com/a",
                    "content": "The lawsuit was settled in 2026.",
                    "published_date": "2026-06-01",
                }
            ]
        }


def _orchestrator_text(prompt: str) -> str:
    if 'Current company guess: ""' in prompt:
        return '{"company":"","needsClarifiers":true,"clarifiers":[],"reason":"missing"}'
    if "redFlagSummary" in prompt:
        return (
            '{"summary":"Acme summary with [Acme source](https://example.com/a).",'
            '"sections":[{"lane":"financial","title":"Financial","body":"Cited.",'
            '"findingIds":[]}],"redFlagSummary":"None open."}'
        )
    if "follow-up" in prompt.lower() or '"answer"' in prompt:
        return '{"answer":"From the current Acme report."}'
    return '{"company":"Acme","needsClarifiers":false,"clarifiers":[],"reason":"named"}'


def _worker_text(prompt: str) -> str:
    if "You are the compliance researcher" in prompt:
        return (
            '{"findings":[{"claim":"Acme faced a product lawsuit.",'
            '"severity":"high","isRedFlag":true,"eventName":"Product lawsuit",'
            '"sourceUrls":["https://example.com/a"],"documentDate":"2026-06-01"}],'
            '"nextQuery":null,"done":true,"note":"one event"}'
        )
    return (
        '{"findings":[{"claim":"Acme published a current report.",'
        '"severity":"low","isRedFlag":false,"eventName":null,'
        '"sourceUrls":["https://example.com/a"],"documentDate":"2026-06-01"}],'
        '"nextQuery":null,"done":true,"note":"enough"}'
    )


def _runtime():
    search = RecordingSearch()
    orchestrator = ScriptedModel(_orchestrator_text)
    worker = ScriptedModel(_worker_text)
    runtime = ResearchRuntime(
        orchestrator=orchestrator,
        worker=worker,
        search_factory=lambda _mode: search,
    )
    return runtime, orchestrator, worker, search


def test_graph_has_fixed_nodes() -> None:
    runtime, _, _, _ = _runtime()
    names = set(runtime.graph.get_graph().nodes)
    assert {
        "orchestrate",
        "build_plan",
        "research",
        "red_flag_dives",
        "synthesize",
        "follow_up",
    } <= names


def test_named_company_runs_lanes_and_resolves_red_flag() -> None:
    runtime, orchestrator, worker, search = _runtime()
    result = runtime.graph.invoke(
        initial_state("Research Acme Corp for supplier risk", headless=True)
    )
    assert result["phase"] == "done"
    assert result["company"] == "Acme"
    assert result["researched"] is True
    assert "https://example.com/a" in result["report"]["summary"]
    flags = [item for item in result["findings"] if item["lane"] == "compliance"]
    assert flags[0]["resolved"] is True
    assert flags[0]["severity"] == "moderate"
    assert worker.calls == 4
    assert orchestrator.calls == 2
    assert len(search.queries) == 5


def test_missing_company_stops_before_research() -> None:
    runtime, orchestrator, worker, search = _runtime()
    result = runtime.graph.invoke(
        initial_state("What should we look at?", headless=True)
    )
    assert result["phase"] == "clarify"
    assert worker.calls == 0
    assert orchestrator.calls == 1
    assert search.queries == []
    assert "Knorr-Bremse" in result["messages"][-1].content
