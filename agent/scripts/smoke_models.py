"""Live smoke test: Nemotron on Nebius Token Factory through LiteLLM.

Runs the T1-T7 checks from docs/plans/01-model-layer.md and writes a markdown
table to scripts/smoke_results.md. Uses the same settings as buddy.models.

    uv run python scripts/smoke_models.py --dry-run     # print config, no API calls
    uv run python scripts/smoke_models.py               # default models
    uv run python scripts/smoke_models.py --models nebius/nvidia/Nemotron-3-Ultra-550b-a55b
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGENT_DIR))

import httpx  # noqa: E402
import litellm  # noqa: E402

from buddy.models import TOKEN_FACTORY_BASE, model_config  # noqa: E402

DATASET_INFO_TOOL = {
    "type": "function",
    "function": {
        "name": "dataset_info",
        "description": "Return the number of suppliers (rows) and columns in the Siemens supplier risk dataset.",
        "parameters": {"type": "object", "properties": {}},
    },
}
WEATHER_TOOL = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather for a city.",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}
DATASET_QUESTION = "How many suppliers are in our dataset?"
FORCED_DATASET_INFO = {"type": "function", "function": {"name": "dataset_info"}}

results: list[dict] = []


def api_base() -> str:
    return os.getenv("NEBIUS_API_BASE", TOKEN_FACTORY_BASE)


def call(model: str, messages: list, effort: str = "low", stream: bool = False, **kwargs):
    """One completion with the same transport settings as buddy.models; retries once on 429."""
    params = dict(
        model=model,
        api_base=api_base(),
        messages=messages,
        extra_body={"reasoning_effort": effort},
        max_tokens=1024,
        timeout=90,
        stream=stream,
        **kwargs,
    )
    for attempt in (1, 2):
        try:
            start = time.perf_counter()
            if stream:
                chunks = list(litellm.completion(**params))
                response = litellm.stream_chunk_builder(chunks, messages=messages)
            else:
                response = litellm.completion(**params)
            return response, int((time.perf_counter() - start) * 1000)
        except litellm.RateLimitError:
            if attempt == 2:
                raise
            time.sleep(5)


def reasoning_location(message) -> str:
    content = message.content or ""
    if getattr(message, "reasoning_content", None):
        return "reasoning_content"
    if "<think>" in content:
        return "<think> in content"
    return "none"


def reasoning_tokens(response) -> int | None:
    details = getattr(response.usage, "completion_tokens_details", None)
    return getattr(details, "reasoning_tokens", None) if details else None


def record(model: str, test: str, ok: bool, ms: int | None = None, reasoning: str = "", notes: str = "") -> None:
    row = {"model": model.removeprefix("nebius/"), "test": test, "ok": ok, "ms": ms, "reasoning": reasoning, "notes": notes}
    results.append(row)
    print(f"  {'PASS' if ok else 'FAIL'}  {test:<22} {ms or '':>6} ms  {reasoning:<20} {notes}")


def first_tool_call(message):
    calls = message.tool_calls or []
    return calls[0] if calls else None


def run_test(model: str, name: str, fn) -> None:
    try:
        fn(model)
    except Exception as exc:  # report and keep going; one failure must not hide the rest
        record(model, name, False, notes=f"{type(exc).__name__}: {str(exc)[:160]}")


def t1_catalog(models: list[str]) -> None:
    print("T1 catalog")
    response = httpx.get(
        f"{api_base()}/models",
        params={"verbose": "true"},
        headers={"Authorization": f"Bearer {os.environ['NEBIUS_API_KEY']}"},
        timeout=30,
    )
    response.raise_for_status()
    available = {m["id"]: m for m in response.json().get("data", [])}
    for model_id in sorted(i for i in available if i.lower().startswith("nvidia/")):
        print(f"    {model_id}")
    for model in models:
        bare = model.removeprefix("nebius/")
        record(model, "T1 catalog", bare in available, notes="listed" if bare in available else "not in /v1/models")


def t2_plain(model: str) -> None:
    response, ms = call(model, [{"role": "user", "content": "Reply with exactly: OK"}])
    message = response.choices[0].message
    content = (message.content or "").strip()
    record(model, "T2 plain answer", "OK" in content, ms, reasoning_location(message), f"content={content[:40]!r}")


def t3_forced_tool(model: str) -> None:
    response, ms = call(
        model,
        [{"role": "user", "content": DATASET_QUESTION}],
        tools=[DATASET_INFO_TOOL],
        tool_choice=FORCED_DATASET_INFO,
    )
    message = response.choices[0].message
    tool_call = first_tool_call(message)
    ok = bool(tool_call) and tool_call.function.name == "dataset_info"
    if ok:
        json.loads(tool_call.function.arguments or "{}")  # raises if the arguments are not valid JSON
    record(model, "T3 forced tool", ok, ms, reasoning_location(message), f"call={tool_call.function.name if tool_call else None}")


def t4_auto_tool(model: str, effort: str = "low", stream: bool = False, label: str = "T4 auto tool") -> None:
    response, ms = call(
        model,
        [{"role": "user", "content": DATASET_QUESTION}],
        effort=effort,
        stream=stream,
        tools=[DATASET_INFO_TOOL, WEATHER_TOOL],
        tool_choice="auto",
    )
    message = response.choices[0].message
    tool_call = first_tool_call(message)
    ok = bool(tool_call) and tool_call.function.name == "dataset_info"
    notes = f"call={tool_call.function.name if tool_call else None}, reasoning_tokens={reasoning_tokens(response)}"
    record(model, label, ok, ms, reasoning_location(message), notes)


def t5_tool_result(model: str) -> None:
    messages = [
        {"role": "user", "content": DATASET_QUESTION},
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "dataset_info", "arguments": "{}"}}],
        },
        {"role": "tool", "tool_call_id": "call_1", "name": "dataset_info", "content": json.dumps({"rows": 10000, "columns": 46})},
    ]
    response, ms = call(model, messages, tools=[DATASET_INFO_TOOL])
    message = response.choices[0].message
    content = message.content or ""
    ok = "10,000" in content or "10000" in content or "10 000" in content
    record(model, "T5 tool result", ok, ms, reasoning_location(message), f"content={content.strip()[:60]!r}")


def t7_reasoning(model: str) -> None:
    for effort in ("none", "low", "medium"):
        try:
            t4_auto_tool(model, effort=effort, label=f"T7 effort={effort}")
        except Exception as exc:
            record(model, f"T7 effort={effort}", False, notes=f"{type(exc).__name__}: {str(exc)[:160]}")


def write_report(path: Path) -> None:
    lines = [
        "# Smoke test results: Nemotron on Token Factory",
        "",
        f"Base URL: `{api_base()}` · run at {time.strftime('%Y-%m-%d %H:%M')}",
        "",
        "| Model | Test | Result | Latency (ms) | Reasoning location | Notes |",
        "|---|---|---|---|---|---|",
    ]
    for r in results:
        notes = r["notes"].replace("|", "\\|")
        lines.append(f"| {r['model']} | {r['test']} | {'✅' if r['ok'] else '❌'} | {r['ms'] or ''} | {r['reasoning']} | {notes} |")
    path.write_text("\n".join(lines) + "\n")
    print(f"\nWrote {path}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--models", nargs="+", help="LiteLLM model strings (default: the configured role models)")
    parser.add_argument("--dry-run", action="store_true", help="print the resolved config and exit without API calls")
    parser.add_argument("--out", type=Path, default=AGENT_DIR / "scripts" / "smoke_results.md")
    args = parser.parse_args()

    role_configs = {role: model_config(role) for role in ("supervisor", "data", "research")}
    models = args.models or sorted({cfg["model"] for cfg in role_configs.values()})

    print(f"API base: {api_base()}")
    print(f"NEBIUS_API_KEY set: {'yes' if os.getenv('NEBIUS_API_KEY') else 'no'}")
    for role, cfg in role_configs.items():
        print(f"  {role:<10} {cfg['model']:<45} reasoning_effort={cfg['extra_body']['reasoning_effort']}")
    print(f"Models under test: {', '.join(models)}")
    if args.dry_run:
        return 0
    if not os.getenv("NEBIUS_API_KEY"):
        print("NEBIUS_API_KEY missing: copy agent/.env.example to agent/.env and add your key")
        return 1

    try:
        t1_catalog(models)
    except Exception as exc:
        record("(catalog)", "T1 catalog", False, notes=f"{type(exc).__name__}: {str(exc)[:160]}")
    for model in models:
        print(f"\n{model}")
        run_test(model, "T2 plain answer", t2_plain)
        run_test(model, "T3 forced tool", t3_forced_tool)
        run_test(model, "T4 auto tool", t4_auto_tool)
        run_test(model, "T5 tool result", t5_tool_result)
        run_test(model, "T6 streaming tool", lambda m: t4_auto_tool(m, stream=True, label="T6 streaming tool"))
        t7_reasoning(model)
        time.sleep(1)

    write_report(args.out)
    failed = [r for r in results if not r["ok"]]
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
