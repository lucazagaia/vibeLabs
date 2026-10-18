# Step 2: ADK backend served over AG-UI

Part of [00-basics-architecture.md](00-basics-architecture.md). It uses **C1** (`get_model()`, from Step 1) and produces **C2** (the agent endpoint) and the backend half of **C4** (skeleton tools).

## Context
Step 1 proved that ADK and Nemotron work together locally (`adk run`). This step puts the agent behind an **HTTP endpoint that speaks AG-UI**, so the CopilotKit frontend (Step 3) can talk to it. It also introduces the real root agent, **`buddy`** (the supervisor), and checks the two mechanisms the app is built on:
- frontend tools reach the supervisor
- delegation to a sub-agent through `AgentTool` works

**In scope:**
- FastAPI + ag-ui-adk
- the `buddy` supervisor with `dataset_info`
- frontend-tool wiring
- a stub `data_buddy` delegate
- an HTTP smoke script that exercises it all without a browser

**Out of scope:**
- real Data Buddy tools and scoring
- the UI-state store
- `/api/data/*`
- the frontend

## What we verified in the package source (ag-ui-adk 0.10.0, google-adk 2.12.0)

| # | Finding | Where | Consequence |
|---|---|---|---|
| B1 | `add_adk_fastapi_endpoint(app, agent, path="/", extract_state_from_request=…)` registers the AG-UI `POST {path}`, **plus** `GET /capabilities` and an experimental `POST /agents/state`. | `ag_ui_adk/endpoint.py` | We get capability discovery and thread reload for free. `/agents/state` is what the concept plan's reload path relies on. |
| B2 | `ADKAgent(...)` accepts, among others: `app_name`, `user_id`, `use_in_memory_services`, `session_service`, `use_thread_id_as_session_id`, `execution_timeout_seconds`, `tool_timeout_seconds`, `emit_messages_snapshot`. | `ag_ui_adk/adk_agent.py` | We start in memory. `use_thread_id_as_session_id=True` maps the CopilotKit thread to the ADK session one to one, which is simpler to reason about and needed later for persistence. |
| B3 | ⚠️ **Frontend tools are injected only where an `AGUIToolset()` placeholder sits in an `LlmAgent`'s `tools`.** The adapter walks the agent tree through `sub_agents` and swaps each placeholder for a per-run `ClientProxyToolset`. Without a placeholder, it logs a warning and **the model never sees the frontend tools**. | `adk_agent.py` (`_update_agent_tools_recursive`), `agui_toolset.py` | The supervisor's `tools` **must** include `AGUIToolset()`. It's the supervisor, not the buddies, that owns UI tools, which matches the concept plan. |
| B4 | ⚠️ The **Python** adapter emits **no `SUBAGENT_*` events**. Those exist only in the JS adapter. An `AgentTool` delegation shows up as an ordinary `TOOL_CALL_START/ARGS/END/RESULT` with `toolCallName="data_buddy"`. | grep across `ag_ui_adk/` | The progress chips ("Data Buddy is ranking…") will come from **rendering the `data_buddy` / `research_buddy` tool calls** in the frontend, not from sub-agent events. The concept plan gets a correction note. |
| B5 | `AgentTool` lives at `google.adk.tools.AgentTool`. The wrapped agent runs to completion, and its final text becomes the tool result. | `google/adk/tools/agent_tool.py` | The supervisor gets Data Buddy's answer back as a tool result and keeps control (the concept plan's delegation design). |
| B6 | Thought parts (Nemotron `reasoning_content`, confirmed in Step 1) are emitted as AG-UI **REASONING** events, separate from `TEXT_MESSAGE` events. | `ag_ui_adk/event_translator.py` | The chat stays clean, and Step 3 decides whether to render reasoning. |

## Files

```
vibeLabs/
├─ data/Siemens.csv                 # git mv from repo root (planned in 00)
├─ docs/Siemens_into.md             # git mv from repo root
└─ agent/
   ├─ pyproject.toml                # + ag-ui-adk==0.10.*, fastapi==0.143.*, uvicorn[standard]
   ├─ main.py                       # FastAPI app: AG-UI endpoint + /health
   ├─ buddy/
   │  ├─ paths.py                   # REPO_DIR, DATA_CSV (one place for file paths)
   │  ├─ supervisor.py              # build_supervisor() -> LlmAgent "buddy"
   │  ├─ tools/
   │  │  ├─ __init__.py
   │  │  └─ basic.py                # dataset_info() (moved here from adk_hello)
   │  └─ data_buddy/
   │     ├─ __init__.py
   │     └─ agent.py                # stretch: stub LlmAgent "data_buddy"
   └─ scripts/
      ├─ adk_hello/agent.py         # now imports buddy.tools.basic.dataset_info (no duplicate)
      └─ agui_smoke.py              # streams RunAgentInput to :8000 and prints AG-UI events
```

## Code outlines

**`main.py`**
```python
from fastapi import FastAPI
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from buddy.supervisor import build_supervisor

app = FastAPI(title="vibeLabs Buddy agent")

buddy = ADKAgent(
    adk_agent=build_supervisor(),
    app_name="vibelabs",
    user_id="demo",                     # single demo user for the hackathon
    use_in_memory_services=True,        # persistence comes with the UI-state store later
    use_thread_id_as_session_id=True,   # CopilotKit thread == ADK session
)
add_adk_fastapi_endpoint(app, buddy, path="/")   # C2: AG-UI POST /, plus /capabilities, /agents/state

@app.get("/health")
def health():
    return {"ok": True}
```

**`buddy/supervisor.py`**
```python
from google.adk.agents import LlmAgent
from google.adk.tools import AgentTool
from ag_ui_adk import AGUIToolset
from buddy.models import get_model
from buddy.tools.basic import dataset_info
from buddy.data_buddy.agent import build_data_buddy   # stretch

INSTRUCTION = """You are Buddy, the assistant in a supplier-risk app for rail procurement buyers.
- Questions about the dataset's size: call dataset_info.
- Questions about specific suppliers, rankings or comparisons: call data_buddy with the user's request.
- When the user asks to show something on the dashboard or to display a notice, call show_notice.
- Answer in 1-2 short sentences. Never invent numbers; only use tool results."""

def build_supervisor() -> LlmAgent:
    return LlmAgent(
        name="buddy",
        model=get_model("supervisor"),
        instruction=INSTRUCTION,
        tools=[dataset_info, AgentTool(agent=build_data_buddy()), AGUIToolset()],  # B3: placeholder is required
    )
```

**`buddy/data_buddy/agent.py` (stretch stub):** an `LlmAgent("data_buddy", model=get_model("data"))` whose instruction is "You are a placeholder. Reply with exactly: `data_buddy received: <the request>`". It proves the delegation round trip and nothing more.

**`scripts/agui_smoke.py`**
- It POSTs a `RunAgentInput` (`threadId`, `runId`, `messages`, `tools`, `state`, `context`, `forwardedProps`) to `http://localhost:8000/` with `Accept: text/event-stream`.
- It prints each event's `type`, plus the tool name and the text deltas.
- It exits non-zero if an expected event is missing.

| Scenario | Request | Expected event sequence |
|---|---|---|
| S1 hello | "Hi Buddy" | `RUN_STARTED` → (`REASONING_*`) → `TEXT_MESSAGE_START/CONTENT/END` → `RUN_FINISHED` |
| S2 backend tool | "How many suppliers are in the dataset?" | `TOOL_CALL_*` with `dataset_info` → `TOOL_CALL_RESULT` → text mentioning 10,000 → `RUN_FINISHED` |
| S3 frontend tool | "Show a notice saying hello", with `tools=[show_notice]` in the input (C4 schema) | `TOOL_CALL_START show_notice` with args `{"text": …}` → `RUN_FINISHED`. The run pauses for the browser, which proves frontend tools reach the model **without a browser** |
| S4 delegation (stretch) | "Rank the suppliers by financial risk" | `TOOL_CALL_START data_buddy` → `TOOL_CALL_RESULT` containing "data_buddy received" → final text |

## Execution order, with pauses

**2a: core backend**
1. Run `git mv Siemens.csv data/` and `git mv Siemens_into.md docs/`, and add `buddy/paths.py`. Update `adk_hello` to import the shared `dataset_info`.
2. `uv add "ag-ui-adk==0.10.*" "fastapi==0.143.*" "uvicorn[standard]"`, then check that `uv.lock` resolves without conflicts.
3. Write `main.py`, `supervisor.py` and `tools/basic.py`. For now, leave the `AgentTool` line out of the supervisor.
4. Start the server in the background with `uv run uvicorn main:app --port 8000`, then check `curl localhost:8000/health` and `curl localhost:8000/capabilities`.
5. Run `agui_smoke.py` scenarios S1–S3.

**⏸ Pause 2a→2b:** I show the event logs for S1–S3. You say go for the delegation stretch, or skip it.

**2b: delegation stretch**
6. Add the `data_buddy` stub and the `AgentTool`, restart the server, and run S4.
7. Commit locally. No push.

**⏸ Checkpoint 2:** the event logs for S1–S4 and the decisions below. Step 3's plan starts only after your go.

## Decisions to settle at Checkpoint 2
1. **Sessions:** stay in memory until the UI-state store, or switch to ADK's SQLite `DatabaseSessionService` now? I recommend in memory for now.
2. **Progress chips without `SUBAGENT_*` (B4):** render the `data_buddy` tool call as a "Data Buddy is working…" chip in Step 3. Is that acceptable?
3. **Supervisor instruction:** is the tone and length right? It's a first draft.
4. **Concept plan correction:** update `buddy-capability-plan.md` and Notion with the B3/B4 findings.

## Pitfalls we already know about
- **A missing `AGUIToolset()` (B3)** means frontend tools silently disappear. S3 catches this.
- **Paths:** the CSV moves to `data/`, so every file path comes from `buddy/paths.py`, resolved from `__file__` and not from the current working directory.
- **The server process:** run uvicorn in the background and stop it after the checks. Don't leave stray servers on :8000.
- **`--reload`:** `.env` is loaded once at import. After changing `.env`, restart the server rather than relying on reload.
- **Tool-call casing:** AG-UI events use camelCase (`toolCallName`, `threadId`). The smoke script reads them exactly that way.

## Done when
- [ ] `uv run uvicorn main:app --port 8000` starts, and `/health` returns `{"ok": true}`.
- [ ] S1, S2 and S3 show the expected event sequences.
- [ ] S4 shows the delegation round trip, or the stretch was explicitly skipped.
- [ ] `adk run scripts/adk_hello` still works after the refactor.
- [ ] No secrets in git, and nothing under `.adk/` committed.
