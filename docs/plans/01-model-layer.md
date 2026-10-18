# Step 1: Model layer (LiteLLM → Nemotron on Nebius Token Factory)

Part of [00-basics-architecture.md](00-basics-architecture.md). It produces contract **C1** (`get_model(role)`) for Step 2.

## Context
Every agent in Buddy (the supervisor, Data Buddy and Research Buddy) gets its model from one place. This step builds that place and **proves, with real calls, that Nemotron on Token Factory works for what we need**:
- plain answers
- tool calling, both forced and automatic, streaming included
- reasoning output that stays out of the chat text

The model is the biggest unknown in the stack, which is why this step comes first.

**In scope:**
- the `agent/` uv project skeleton (model dependencies only)
- `buddy/models.py`
- a smoke-test script
- a minimal `adk run` agent

**Out of scope:**
- FastAPI and ag-ui-adk (Step 2)
- the frontend (Step 3)

## What we already verified from docs and package sources (no API key needed)

| # | Finding | Source | Consequence |
|---|---|---|---|
| F1 | LiteLLM's `nebius/` provider still defaults to the **legacy** base URL `https://api.studio.nebius.ai/v1`. It can be overridden with `NEBIUS_API_BASE`. | `litellm 1.106.0`: `get_llm_provider_logic.py` | We **always set** `api_base=https://api.tokenfactory.nebius.com/v1` explicitly, and don't rely on the legacy domain still working. |
| F2 | LiteLLM's model map lists both of our models with `supports_function_calling: true` and `supports_reasoning: true`. `nebius/nvidia/Nemotron-3_5-Lightning` has a 1M-token context; `nebius/nvidia/nemotron-3-super-120b-a12b` has 262k. | `model_prices_and_context_window_backup.json` | This is a good sign, but the map isn't proof. The smoke test confirms it against the live API. |
| F3 | The Token Factory chat API accepts `reasoning_effort` ∈ `none, minimal, low, medium, high, xhigh, max`, and returns `reasoning_content` / `reasoning` on the message. | Token Factory API reference: "Create chat completion" | Reasoning is controllable per request and comes back in a **separate field**, not mixed into `content`. |
| F4 | LiteLLM's `NebiusConfig` only forwards params on its supported list, and that list doesn't include **`reasoning_effort`**, so LiteLLM drops it silently. | `litellm/llms/nebius/chat/transformation.py` + `OpenAIGPTConfig.get_supported_openai_params` | We send it through **`extra_body={"reasoning_effort": …}`**, which LiteLLM passes through untouched. |
| F5 | ADK's `LiteLlm(model, **kwargs)` forwards extra kwargs (`api_base`, `api_key`, `extra_body`, `temperature`, …) to `litellm.completion`. It manages `messages`, `tools` and `stream` itself. | `google-adk 2.12.0`: `models/lite_llm.py` | All model config lives in `get_model()`. |
| F6 | ADK maps `reasoning_content` to `Part(thought=True)`, and ag-ui-adk turns thought parts into AG-UI **REASONING** events, separate from `TEXT_MESSAGE` events. | `lite_llm.py`, `ag_ui_adk/event_translator.py` | If Token Factory fills `reasoning_content`, thinking **won't leak into chat text**. The smoke test checks that it doesn't come back as `<think>` tags inside `content` instead. |
| F7 | `ag-ui-adk 0.10.0` requires `google-adk>=1.28.1,<3`, and `google-adk 2.12.0` requires `fastapi>=0.133`. | PyPI metadata | The pins from the umbrella plan are compatible. |

## Prerequisite (Luca)
- Create a Nebius Token Factory account and an API key at tokenfactory.nebius.com → API keys. The hackathon credits are already on the account.
- After sub-step 1a, put the key in `agent/.env` yourself. That file is gitignored. Claude never sees or types the key.
- **Cost:** the smoke test makes about 30–40 short calls, which costs a few cents of credits.

## Files

```
vibeLabs/
├─ .gitignore                       # new: .env, .env.*, !.env.example, .venv/, __pycache__/, node_modules/, .next/, *.sqlite
└─ agent/
   ├─ pyproject.toml                # uv project, Python 3.13
   ├─ .python-version               # 3.13
   ├─ .env.example                  # committed template (no secrets)
   ├─ buddy/
   │  ├─ __init__.py
   │  └─ models.py                  # C1: get_model(role)
   └─ scripts/
      ├─ smoke_models.py            # live checks against Token Factory
      └─ adk_hello/
         ├─ __init__.py
         └─ agent.py                # root_agent using get_model("supervisor") + one toy tool
```

**`pyproject.toml` dependencies (Step 1 only):**
- `google-adk==2.12.*`
- `litellm==1.106.*`
- `python-dotenv`
- `httpx`, for the models-list call

Step 2 adds `ag-ui-adk==0.10.*`, `fastapi==0.143.*` and `uvicorn`.

**`.env.example`:**
```
NEBIUS_API_KEY=
NEBIUS_API_BASE=https://api.tokenfactory.nebius.com/v1
SUPERVISOR_MODEL=nebius/nvidia/Nemotron-3_5-Lightning
DATA_BUDDY_MODEL=nebius/nvidia/Nemotron-3_5-Lightning
RESEARCH_BUDDY_MODEL=nebius/nvidia/nemotron-3-super-120b-a12b
SUPERVISOR_REASONING=low
DATA_BUDDY_REASONING=low
RESEARCH_BUDDY_REASONING=medium
```

## `buddy/models.py` (outline)

```python
from typing import Literal
import os
from pathlib import Path
from dotenv import load_dotenv
from google.adk.models.lite_llm import LiteLlm

load_dotenv(Path(__file__).resolve().parents[1] / ".env")  # agent/.env, independent of cwd

TOKEN_FACTORY_BASE = "https://api.tokenfactory.nebius.com/v1"
Role = Literal["supervisor", "data", "research"]

_ROLES = {  # role -> (model env var, default model, reasoning env var, default effort)
    "supervisor": ("SUPERVISOR_MODEL", "nebius/nvidia/Nemotron-3_5-Lightning", "SUPERVISOR_REASONING", "low"),
    "data":       ("DATA_BUDDY_MODEL", "nebius/nvidia/Nemotron-3_5-Lightning", "DATA_BUDDY_REASONING", "low"),
    "research":   ("RESEARCH_BUDDY_MODEL", "nebius/nvidia/nemotron-3-super-120b-a12b", "RESEARCH_BUDDY_REASONING", "medium"),
}

def model_config(role: Role) -> dict:
    """Plain dict of the LiteLLM settings for a role (also used by the smoke test)."""
    ...  # model id, api_base (NEBIUS_API_BASE or TOKEN_FACTORY_BASE), extra_body={"reasoning_effort": …}

def get_model(role: Role) -> LiteLlm:
    """C1: the single place every agent gets its model from."""
    if not os.getenv("NEBIUS_API_KEY"):
        raise RuntimeError("NEBIUS_API_KEY missing: copy agent/.env.example to agent/.env and add your key")
    return LiteLlm(**model_config(role))
```

**Design rules:**
- No model ID is hard-coded anywhere else in the codebase.
- A missing key fails fast with a clear message.
- The key is never logged. The smoke output prints only the model ID and base URL.

## `scripts/smoke_models.py`: what it tests

Run it with `uv run python scripts/smoke_models.py [--models …]`. It calls LiteLLM directly, with the same settings `model_config()` produces. Candidates:
- `Nemotron-3_5-Lightning`
- `nemotron-3-super-120b-a12b`
- optional reference: `Nemotron-3-Ultra-550b-a55b`

| Test | What it does | Pass condition |
|---|---|---|
| T1 Catalog | `GET /v1/models?verbose=true` and lists every `nvidia/*` model with the capability fields the API returns | Both default models are listed |
| T2 Plain answer | "Reply with exactly: OK" | Content is `OK` |
| T3 Forced tool call | Tool `dataset_info({})` (the C4 schema) with `tool_choice` forced | `tool_calls[0].function.name == "dataset_info"` and its arguments parse as JSON |
| T4 Auto tool call | "How many suppliers are in our dataset?" with `tool_choice="auto"`, two tools offered (`dataset_info`, a decoy `get_weather`) | The right tool is picked |
| T5 Tool result round trip | Feed `{"rows": 10000, "columns": 46}` back as a tool message | The answer mentions 10,000 |
| T6 Streaming tool call | T4 with `stream=True`, assembled from chunks (ADK streams over SSE) | Same result as T4 |
| T7 Reasoning | T2 and T4 at `reasoning_effort` = `none`, `low`, `medium` | It records whether reasoning appears in `reasoning_content` or as `<think>…</think>` inside `content`, plus reasoning tokens and latency |

**Output:** a markdown table with these columns:
- model
- test
- pass/fail
- latency in ms
- reasoning location
- notes

It's printed and also written to `agent/scripts/smoke_results.md`, which holds no secrets and is committed as the record for Checkpoint 1.

## `scripts/adk_hello/agent.py`: the ADK end-to-end check
- It defines `root_agent = LlmAgent(name="hello", model=get_model("supervisor"), instruction=…, tools=[dataset_info])`.
- For now `dataset_info` is a stub that returns the real row and column counts of `Siemens.csv` (pandas isn't needed: the stdlib `csv` module is enough).
- Run it with `cd agent && uv run adk run scripts/adk_hello`. Ask it "how many suppliers do we have?" and expect a tool call followed by an answer that mentions 10,000.

## Execution order, with a pause in the middle

**1a: scaffold (no key needed)**
1. Branch `feat/model-layer`, cut from `chore/plans-and-layout`.
2. Run `uv init agent` (app layout, Python 3.13), then `uv add google-adk==2.12.* litellm==1.106.* python-dotenv httpx`.
3. Write `.gitignore`, `.env.example`, `models.py`, `smoke_models.py` and `adk_hello/agent.py`.
4. Run the offline checks:
   - `uv run python -c "import buddy.models"`
   - `uv run python scripts/smoke_models.py --dry-run`, which prints the resolved config without calling the API

**⏸ Pause 1a→1b:** you copy `.env.example` to `.env` and add your key. Say "key is in" when done.

**1b: live checks**
5. Run `smoke_models.py` against both default models (and Ultra if you want it), and save `smoke_results.md`.
6. Run `adk run scripts/adk_hello` with the dataset question.
7. Commit locally. No push.

**⏸ Checkpoint 1:** I show the results table and the `adk run` transcript, then we settle the decisions below. Step 2's plan starts only after your go.

## Decisions to settle at Checkpoint 1
1. **Supervisor model:** keep Lightning, or move it to Super, based on T4 routing quality and latency?
2. **Reasoning defaults per role:** `none`, `low` or `medium`, based on T7 latency versus answer quality.
3. **Reasoning visibility in the UI:** hide the REASONING events, or show them as a collapsible "thinking" line? This only matters if reasoning comes back as `reasoning_content`. If it comes back as `<think>` tags in `content`, we add a small strip-filter in `models.py`.
4. **Ultra:** is it worth keeping as an option for Research Buddy?

## Pitfalls we already know about
- **Legacy base URL (F1).** Forgetting `api_base` may still work today but break later, so it's always set explicitly.
- **A dropped `reasoning_effort` (F4).** If it's passed as a top-level kwarg it silently does nothing. Only `extra_body` works.
- **Model ID casing.** Token Factory IDs are case-sensitive (`Nemotron-3_5-Lightning` vs `nemotron-3-super-120b-a12b`). T1 prints the exact IDs.
- **Rate limits.** The smoke test runs sequentially, with a short sleep, and retries once on HTTP 429.
- **`.env` loading.** `models.py` loads `agent/.env` by path, relative to the file and not to the current working directory, so `adk run` and `uvicorn` both find it.

## Done when
- [ ] T1–T6 pass for both default models, or a documented fallback is chosen.
- [ ] T7 is recorded, and we know where reasoning shows up.
- [ ] `adk run scripts/adk_hello` answers the dataset question through the tool.
- [ ] No secret appears in git: `git grep -i "NEBIUS_API_KEY=" -- ':!*.example'` returns nothing.
