"""Skill smoke test (plan 05, step 5a): does the ADK Skill work with Nemotron + ag-ui-adk?

Checks, with a STUB compare_suppliers (it only echoes its arguments; the engine comes in 5b):
  1. The skill loads (load_skill) and compare_suppliers is only declared to the model after that.
  2. The tool schema carries the enums (metric keys, intents, directions) and the glossary.
  3. Through ag-ui-adk, the run streams load_skill + compare_suppliers tool-call events.

    uv run python scripts/skill_smoke.py
"""

import asyncio
import json
import sys
import uuid
from pathlib import Path
from typing import Literal, get_args

AGENT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AGENT_DIR))

from ag_ui.core import RunAgentInput, UserMessage  # noqa: E402
from ag_ui_adk import ADKAgent  # noqa: E402
from google.adk.agents import LlmAgent  # noqa: E402
from google.adk.apps import App, ResumabilityConfig  # noqa: E402
from google.adk.runners import InMemoryRunner  # noqa: E402
from google.adk.skills import load_skill_from_dir  # noqa: E402
from google.adk.tools import FunctionTool  # noqa: E402
from google.adk.tools.skill_toolset import SkillDiscoveryMode, SkillToolset  # noqa: E402
from google.genai import types  # noqa: E402

from buddy.cards.schema import GLOSSARY, Direction, Intent, Mention, MetricKey  # noqa: E402
from buddy.cards.validate import needs_choice, resolve_intent  # noqa: E402
from buddy.models import get_model  # noqa: E402

SKILL_DIR = AGENT_DIR / "buddy" / "skills" / "supplier-comparison-cards"
calls: list[dict] = []


def compare_suppliers(
    request: str,
    intent: Intent,
    direction: Direction,
    mentions: list[Mention] = [],
    supplier_ids: list[str] = [],
    use_compare_tray: bool = False,
    rank_by: MetricKey | None = None,
    rank_order: Literal["lowest", "highest"] | None = None,
    limit: int | None = None,
) -> dict:
    calls.append({"request": request, "intent": intent, "direction": direction,
                  "mentions": [m if isinstance(m, dict) else m.model_dump() for m in mentions],
                  "supplier_ids": supplier_ids, "use_compare_tray": use_compare_tray})
    return {"status": "ok", "summary": __import__("os").environ.get("STUB_SUMMARY", "Lower is better for financial health. Safest: SUPP_00450 (score 21). Riskiest: SUPP_00012 (score 54). The card is on the dashboard.")}
    # A summary that reads like a failure ("not built yet") made the model retry the tool up to 4 times.


compare_suppliers.__doc__ = (
    "Build a supplier comparison card and show it on the dashboard.\n\nMetric glossary (key: meaning):\n"
    + "\n".join(f"- {k}: {v}" for k, v in GLOSSARY.items())
)

seen_tools: list[list[str]] = []


def record_tools(callback_context, llm_request):
    seen_tools.append(sorted(llm_request.tools_dict.keys()))
    return None


def build_agent() -> LlmAgent:
    skill = load_skill_from_dir(SKILL_DIR)
    toolset = SkillToolset(skills=[skill], additional_tools=[compare_suppliers], discovery_mode=SkillDiscoveryMode.EAGER)
    return LlmAgent(
        name="data_buddy",
        model=get_model("data"),
        instruction="You are Data Buddy, a supplier-risk assistant. Use your skills when they apply.",
        tools=[toolset],
        before_model_callback=record_tools,
    )


PROMPTS = [
    "Which of SUPP_00012, SUPP_00450 and SUPP_00731 is least likely to go bankrupt?",
    "Compare the financial risk of SUPP_00012 and SUPP_00450",
]


async def check_adk() -> bool:
    print("== 1+2. ADK runner (tool gating, schema, extraction)")
    schema = FunctionTool(compare_suppliers)._get_declaration().parameters_json_schema
    metric_enum = schema["$defs"]["Mention"]["properties"]["metrics"]["items"]["enum"] if "$defs" in schema else None
    print(f"   schema: intent enum={schema['properties']['intent']['enum']}  metric enum size={len(metric_enum or [])} "
          f"(expected {len(get_args(MetricKey))})  glossary in description={'Financial_Health_Score:' in compare_suppliers.__doc__}")
    ok = metric_enum is not None and len(metric_enum) == len(get_args(MetricKey))
    for prompt in PROMPTS:
        calls.clear(); seen_tools.clear()
        runner = InMemoryRunner(agent=build_agent(), app_name="smoke")
        session = await runner.session_service.create_session(app_name="smoke", user_id="u")
        fn_calls = []
        async for ev in runner.run_async(user_id="u", session_id=session.id,
                                         new_message=types.Content(role="user", parts=[types.Part(text=prompt)])):
            for p in (ev.content.parts if ev.content else []):
                if p.function_call:
                    fn_calls.append(p.function_call.name)
        gated = bool(seen_tools) and "compare_suppliers" not in seen_tools[0] and any("compare_suppliers" in t for t in seen_tools)
        print(f"   prompt: {prompt!r}")
        print(f"     tools per model call: {seen_tools}")
        print(f"     function calls: {fn_calls}")
        print(f"     compare_suppliers args: {json.dumps(calls[-1]) if calls else None}")
        print(f"     gated (hidden before load_skill, visible after): {gated}")
        ok = ok and gated and "load_skill" in fn_calls and bool(calls)
    return ok


async def check_agui() -> bool:
    print("== 3. Through ag-ui-adk (as served at /data)")
    calls.clear()
    adk_app = App(name="data_buddy", root_agent=build_agent(), resumability_config=ResumabilityConfig(is_resumable=True))
    agent = ADKAgent.from_app(adk_app, user_id="demo", use_in_memory_services=True, use_thread_id_as_session_id=True)
    run = RunAgentInput(thread_id=f"t-{uuid.uuid4()}", run_id=f"r-{uuid.uuid4()}", state={}, tools=[], context=[],
                        forwarded_props={}, messages=[UserMessage(id=f"m-{uuid.uuid4()}", role="user", content=PROMPTS[0])])
    types_seen, tool_names = [], []
    async for ev in agent.run(run):
        t = ev.type.value if hasattr(ev.type, "value") else str(ev.type)
        types_seen.append(t)
        if t == "TOOL_CALL_START":
            tool_names.append(ev.tool_call_name)
    await agent.close()
    print(f"   tool calls streamed: {tool_names}")
    print(f"   finished: {types_seen[-1] if types_seen else None}   errors: {[t for t in types_seen if 'ERROR' in t]}")
    return "compare_suppliers" in tool_names and types_seen[-1:] == ["RUN_FINISHED"]


async def quick_eval() -> int:
    """Run evals/quick_eval.json through the real skill (stub tool) once; print one line per case."""
    cases = json.loads((AGENT_DIR / "evals" / "quick_eval.json").read_text())["cases"]
    passed = 0
    for c in cases:
        calls.clear()
        runner = InMemoryRunner(agent=build_agent(), app_name="quick")
        session = await runner.session_service.create_session(app_name="quick", user_id="u")
        async for _ in runner.run_async(user_id="u", session_id=session.id,
                                        new_message=types.Content(role="user", parts=[types.Part(text=c["request"])])):
            pass
        a = calls[0] if calls else {"mentions": [], "supplier_ids": [], "intent": None}
        cands = [set(m["metrics"]) for m in a["mentions"]]
        # same rules the engine applies (buddy/cards/validate.py)
        ask = any(needs_choice(sorted(x), c["request"]) for x in cands)
        intent = resolve_intent(a["intent"], a["mentions"])
        picked = set().union(*cands) if cands else set()
        invented = [i for i in a["supplier_ids"] if i not in c["request"]]
        ok = bool(calls) and ask == c["ask"] and (c["ask"] or set(c["metrics"]) <= picked) and not invented
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'}  ask={'yes' if ask else 'no '} (exp {'yes' if c['ask'] else 'no '})  "
              f"{c['request'][:58]:<58} -> {intent:<9} {sorted(picked)}{'  INVENTED IDS ' + str(invented) if invented else ''}")
    print(f"\nquick eval: {passed}/{len(cases)}")
    return 0 if passed == len(cases) else 1


async def main() -> int:
    adk_ok = await check_adk()
    agui_ok = await check_agui()
    print(f"\nRESULT  adk={'PASS' if adk_ok else 'FAIL'}  ag-ui={'PASS' if agui_ok else 'FAIL'}")
    return 0 if adk_ok and agui_ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(quick_eval() if "--quick-eval" in sys.argv else main()))
