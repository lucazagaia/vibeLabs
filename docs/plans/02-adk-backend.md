# Step 2: ADK backend: two agents served over AG-UI

Part of [00-basics-architecture.md](00-basics-architecture.md). It uses **C1** (`get_model()`, from Step 1) and produces **C2** (the agent endpoints) and the backend half of **C4** (skeleton tools).

## Context
Step 1 proved that ADK and Nemotron work together locally (`adk run`). This step puts the agents behind **HTTP endpoints that speak AG-UI**, so the CopilotKit frontend (Step 3) can talk to them.

**Decision (18 Oct):** no orchestrator for now. Instead of a supervisor that routes requests, the user picks the agent with a **deterministic switch button** in the UI: **Data Buddy ⇄ Research Buddy**. The supervisor is simpler to add later than to debug now. It's parked as a possible upgrade at the end of the hackathon (see "Later" below).

So the backend serves **two independent ADK agents**:
- **`data_buddy`** at `/data`: the real starting point for the data features. It has the `dataset_info` tool and receives frontend tools.
- **`research_buddy`** at `/research`: a **stub** for now. It's a plain Nemotron agent with a "research assistant" instruction and no tools yet. It exists to prove the switch end to end.

**In scope:**
- FastAPI + ag-ui-adk serving both agents
- `dataset_info`
- frontend-tool wiring
- an HTTP smoke script that exercises it all without a browser

**Out of scope:**
- real Data Buddy tools and scoring
- the real research pipeline
- the UI-state store
- `/api/data/*`
- the frontend

## What we verified in the docs and package source

| # | Finding | Source | Consequence |
|---|---|---|---|
| B1 | `add_adk_fastapi_endpoint(app, agent, path=…)` registers the AG-UI `POST {path}`, plus `GET {path}/capabilities` and an experimental `POST /agents/state`. It can be called once per agent on the same FastAPI app. | `ag_ui_adk/endpoint.py`, CopilotKit ADK quickstart | One FastAPI app on :8000 serves both agents at different paths. |
| B2 | ⚠️ **Frontend tools are only declared to an agent that has an `AGUIToolset()` placeholder in its `tools`.** This has been documented since ag-ui-adk 0.5 (README migration guide: AG-UI tools "are no longer automatically included"). Without it, the adapter logs a warning and the model never sees the tools. The CopilotKit HITL page that says "automatically forwarded" is outdated on this point. | ag-ui-adk README + `adk_agent.py` | **Both agents get `AGUIToolset()`**, so either one can open dashboard panels. |
| B3 | The README recommends **`ADKAgent.from_app(App(..., resumability_config=ResumabilityConfig(is_resumable=True)))`** whenever the agent pauses for client-side tools and resumes. Every frontend tool is long-running (the run pauses until the browser answers). | ag-ui-adk README ("HITL") | Both agents are wrapped in an ADK `App` with resumability on. |
| B4 | The quickstart uses `session_timeout_seconds=3600` and `use_in_memory_services=True`. `use_thread_id_as_session_id=True` maps a CopilotKit thread to an ADK session one to one. | CopilotKit ADK quickstart, `ADKAgent` signature | We use the same settings. Persistence comes with the UI-state store later. |
| B5 | Thought parts (Nemotron `reasoning_content`, confirmed in Step 1) are emitted as AG-UI **REASONING** events, separate from `TEXT_MESSAGE`. | `ag_ui_adk/event_translator.py` | The chat stays clean. Step 3 decides whether to show reasoning. |

## Files

```
vibeLabs/
├─ data/Siemens.csv                 # git mv from repo root (planned in 00)
├─ docs/Siemens_into.md             # git mv from repo root
└─ agent/
   ├─ pyproject.toml                # + ag-ui-adk==0.10.*, fastapi==0.143.*, uvicorn[standard]
   ├─ main.py                       # FastAPI app: /data, /research, /health
   ├─ buddy/
   │  ├─ paths.py                   # REPO_DIR, DATA_CSV (one place for file paths)
   │  ├─ tools/
   │  │  ├─ __init__.py
   │  │  └─ basic.py                # dataset_info() (moved here from adk_hello)
   │  ├─ data_buddy/
   │  │  ├─ __init__.py
   │  │  └─ agent.py                # build_data_buddy() -> LlmAgent "data_buddy"
   │  └─ research_buddy/
   │     ├─ __init__.py
   │     └─ agent.py                # build_research_buddy() -> stub LlmAgent "research_buddy"
   └─ scripts/
      ├─ adk_hello/agent.py         # now imports buddy.tools.basic.dataset_info (no duplicate)
      └─ agui_smoke.py              # streams RunAgentInput to each endpoint and prints AG-UI events
```

## Code outlines

**`main.py`**
```python
from fastapi import FastAPI
from google.adk.apps import App, ResumabilityConfig
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from buddy.data_buddy.agent import build_data_buddy
from buddy.research_buddy.agent import build_research_buddy

app = FastAPI(title="vibeLabs Buddy agents")

def serve(root_agent, app_name: str, path: str) -> None:
    adk_app = App(name=app_name, root_agent=root_agent,
                  resumability_config=ResumabilityConfig(is_resumable=True))  # B3
    agent = ADKAgent.from_app(
        adk_app,
        user_id="demo",                    # single demo user for the hackathon
        session_timeout_seconds=3600,      # B4
        use_in_memory_services=True,
        use_thread_id_as_session_id=True,
    )
    add_adk_fastapi_endpoint(app, agent, path=path)   # B1

serve(build_data_buddy(), "data_buddy", "/data")              # C2
serve(build_research_buddy(), "research_buddy", "/research")  # C2

@app.get("/health")
def health():
    return {"ok": True, "agents": ["data_buddy", "research_buddy"]}
```

**`buddy/data_buddy/agent.py`**
```python
from google.adk.agents import LlmAgent
from ag_ui_adk import AGUIToolset
from buddy.models import get_model
from buddy.tools.basic import dataset_info

INSTRUCTION = """You are Data Buddy, the data assistant in a supplier-risk app for rail procurement buyers.
- Questions about the dataset's size: call dataset_info.
- When the user asks to show something on the dashboard or to display a notice, call show_notice.
- Answer in 1-2 short sentences. Never invent numbers; only use tool results."""

def build_data_buddy() -> LlmAgent:
    return LlmAgent(name="data_buddy", model=get_model("data"), instruction=INSTRUCTION,
                    tools=[dataset_info, AGUIToolset()])   # B2: placeholder is required
```

**`buddy/research_buddy/agent.py` (stub):** `LlmAgent(name="research_buddy", model=get_model("research"), instruction=…, tools=[AGUIToolset()])`.
- The instruction makes it introduce itself as Research Buddy.
- It says it will research real companies once its tools are added.
- It answers briefly.
- No web tools yet.

**`scripts/agui_smoke.py`**
- It POSTs a `RunAgentInput` (`threadId`, `runId`, `messages`, `tools`, `state`, `context`, `forwardedProps`) to the given endpoint with `Accept: text/event-stream`.
- It prints each event's `type`, plus the tool names and the text deltas.
- It exits non-zero if an expected event is missing.

| Scenario | Endpoint | Request | Expected event sequence |
|---|---|---|---|
| S1 hello | `/data` | "Hi" | `RUN_STARTED` → (`REASONING_*`) → `TEXT_MESSAGE_*` → `RUN_FINISHED`, and the reply identifies itself as Data Buddy |
| S2 backend tool | `/data` | "How many suppliers are in the dataset?" | `TOOL_CALL_*` with `dataset_info` → `TOOL_CALL_RESULT` → text mentioning 10,000 |
| S3 frontend tool | `/data` | "Show a notice saying hello", with `tools=[show_notice]` (C4 schema) | `TOOL_CALL_START show_notice` with args `{"text": …}`. The run pauses for the browser, which proves frontend tools reach the model without a browser |
| S4 switch target | `/research` | "Hi" | Text reply identifying itself as Research Buddy (Super model) |

## Execution order, with a pause
1. Run `git mv Siemens.csv data/` and `git mv Siemens_into.md docs/`, and add `buddy/paths.py`. Update `adk_hello` to import the shared `dataset_info`.
2. `uv add "ag-ui-adk==0.10.*" "fastapi==0.143.*" "uvicorn[standard]"`, then check that `uv.lock` resolves.
3. Write `main.py` and the two agent modules.
4. Start the server in the background with `uv run uvicorn main:app --port 8000`. Check `/health`, `/data/capabilities` and `/research/capabilities`.
5. Run `agui_smoke.py` S1–S4. Then stop the server.
6. Commit locally. No push.

**⏸ Checkpoint 2:** the event logs for S1–S4 and the decisions below. Step 3's plan starts only after your go.

## Decisions to settle at Checkpoint 2
1. **Sessions:** stay in memory until the UI-state store, or switch to ADK's SQLite `DatabaseSessionService` now? I recommend in memory for now.
2. **Switch behaviour (for Step 3):** when the user flips Data ⇄ Research, does each agent keep **its own chat thread**, or do they share one visible conversation? I recommend separate threads, with the switch showing that agent's thread.
3. **Research Buddy's model:** keep Super, or try Nemotron-3.5-Super-VL now that we know it's in the catalog?

## Later (only if there's time at the end): the orchestrator
- Add a supervisor `buddy` with both agents in `sub_agents=[...]` and `mode="single_turn"`. This is the documented ADK 2.x delegation pattern; google-adk 2.12 marks direct `AgentTool` use as discouraged.
- Serve it at `/` as a third agent.
- The switch then gets a third option, "Auto". Nothing in the two-agent setup has to change.
- **Open question for then:** ag-ui-adk has no special handling for `single_turn`, so we'd need to test how the sub-agents' events stream.

## Pitfalls we already know about
- **A missing `AGUIToolset()` (B2)** means frontend tools silently disappear. S3 catches this.
- **Paths:** the CSV moves to `data/`, so every file path comes from `buddy/paths.py`, resolved from `__file__`.
- **Two `ADKAgent`s, one process:** each gets its own `App` name, so sessions don't collide.
- **The server process:** run uvicorn in the background and stop it after the checks.
- **`.env` changes** need a server restart, not `--reload`.
- **Event casing:** AG-UI events use camelCase (`toolCallName`, `threadId`).

## Done when
- [ ] The server starts, and `/health` lists both agents.
- [ ] S1–S4 show the expected event sequences.
- [ ] `adk run scripts/adk_hello` still works after the refactor.
- [ ] No secrets in git, and nothing under `.adk/` committed.
