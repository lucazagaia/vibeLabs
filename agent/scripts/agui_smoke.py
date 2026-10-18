"""AG-UI smoke test: talk to the running agent server without a browser.

Runs scenarios S1-S4 from docs/plans/02-adk-backend.md against
http://localhost:8000 (start it first: `uv run uvicorn main:app --port 8000`).

    uv run python scripts/agui_smoke.py            # all scenarios
    uv run python scripts/agui_smoke.py S2 S3      # selected scenarios
"""

import argparse
import json
import sys
import uuid
from collections import Counter

import httpx

BASE_URL = "http://localhost:8000"

# Contract C4: the frontend tool the browser will register with useFrontendTool.
SHOW_NOTICE_TOOL = {
    "name": "show_notice",
    "description": "Show a short notice card on the dashboard.",
    "parameters": {
        "type": "object",
        "properties": {"text": {"type": "string", "description": "The notice text"}},
        "required": ["text"],
    },
}


def run(path: str, message: str, tools: list | None = None) -> dict:
    """POST one RunAgentInput and collect the streamed AG-UI events."""
    payload = {
        "threadId": f"smoke-{uuid.uuid4()}",
        "runId": f"run-{uuid.uuid4()}",
        "state": {},
        "messages": [{"id": f"msg-{uuid.uuid4()}", "role": "user", "content": message}],
        "tools": tools or [],
        "context": [],
        "forwardedProps": {},
    }
    events: list[dict] = []
    with httpx.stream(
        "POST", f"{BASE_URL}{path}", json=payload, headers={"Accept": "text/event-stream"}, timeout=120
    ) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))

    tool_calls: dict[str, dict] = {}
    text: list[str] = []
    for event in events:
        kind = event.get("type")
        if kind == "TOOL_CALL_START":
            tool_calls[event["toolCallId"]] = {"name": event.get("toolCallName"), "args": "", "result": None}
        elif kind == "TOOL_CALL_ARGS" and event.get("toolCallId") in tool_calls:
            tool_calls[event["toolCallId"]]["args"] += event.get("delta", "")
        elif kind == "TOOL_CALL_RESULT" and event.get("toolCallId") in tool_calls:
            tool_calls[event["toolCallId"]]["result"] = event.get("content")
        elif kind == "TEXT_MESSAGE_CONTENT":
            text.append(event.get("delta", ""))
    return {
        "types": [e.get("type") for e in events],
        "tool_calls": list(tool_calls.values()),
        "text": "".join(text).strip(),
    }


def summarize(result: dict) -> None:
    counts = Counter(result["types"])
    print("  events:   " + ", ".join(f"{t}×{n}" if n > 1 else t for t, n in counts.items()))
    for call in result["tool_calls"]:
        print(f"  tool:     {call['name']}({call['args'] or ''}) -> {call['result']}")
    if result["text"]:
        print(f"  text:     {result['text'][:200]!r}")


def check(name: str, ok: bool, why: str) -> bool:
    print(f"  => {'PASS' if ok else 'FAIL'}: {why}\n")
    return ok


def s1() -> bool:
    print("S1 hello on /data")
    r = run("/data", "Hi! Who are you?")
    summarize(r)
    ok = r["types"][:1] == ["RUN_STARTED"] and "TEXT_MESSAGE_CONTENT" in r["types"] and r["types"][-1] == "RUN_FINISHED"
    return check("S1", ok and "data" in r["text"].lower(), "streamed text reply that identifies as Data Buddy")


def s2() -> bool:
    print("S2 backend tool on /data")
    r = run("/data", "How many suppliers are in the dataset?")
    summarize(r)
    called = any(c["name"] == "dataset_info" for c in r["tool_calls"])
    mentions = any(s in r["text"] for s in ("10,000", "10000", "10 000"))
    return check("S2", called and mentions and r["types"][-1] == "RUN_FINISHED", "dataset_info called and 10,000 in the answer")


def s3() -> bool:
    print("S3 frontend tool on /data")
    r = run("/data", "Show a notice on the dashboard saying hello", tools=[SHOW_NOTICE_TOOL])
    summarize(r)
    notice = next((c for c in r["tool_calls"] if c["name"] == "show_notice"), None)
    args_ok = False
    if notice:
        try:
            args_ok = isinstance(json.loads(notice["args"] or "{}").get("text"), str)
        except json.JSONDecodeError:
            args_ok = False
    return check("S3", bool(notice) and args_ok, "show_notice called with a {text} argument (run then waits for the browser)")


def s4() -> bool:
    print("S4 hello on /research")
    r = run("/research", "Hi! Who are you?")
    summarize(r)
    ok = "TEXT_MESSAGE_CONTENT" in r["types"] and r["types"][-1] == "RUN_FINISHED"
    return check("S4", ok and "research" in r["text"].lower(), "streamed text reply that identifies as Research Buddy")


SCENARIOS = {"S1": s1, "S2": s2, "S3": s3, "S4": s4}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("scenarios", nargs="*", help=f"any of {', '.join(SCENARIOS)} (default: all)")
    args = parser.parse_args()
    unknown = [s for s in args.scenarios if s not in SCENARIOS]
    if unknown:
        parser.error(f"unknown scenario(s): {', '.join(unknown)}")
    health = httpx.get(f"{BASE_URL}/health", timeout=5).json()
    print(f"health: {health}\n")
    results = {}
    for name in args.scenarios or SCENARIOS:
        try:
            results[name] = SCENARIOS[name]()
        except Exception as exc:  # one failing scenario must not hide the others
            results[name] = check(name, False, f"{type(exc).__name__}: {exc}")
    passed = sum(results.values())
    print(f"{passed}/{len(results)} scenarios passed: " + ", ".join(f"{k} {'✅' if v else '❌'}" for k, v in results.items()))
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
