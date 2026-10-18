# Buddy basics: general architecture plan (walking skeleton)

## Context
The concept plan ("Buddy: capability plan", in Notion) is agreed. Next comes Luca's task: **get the basics running end to end** before any Data Buddy features are built. That means three building blocks:
1. a Google ADK backend
2. a CopilotKit frontend with the basic CopilotKit chat interface over AG-UI
3. a LiteLLM wrapper for Nemotron on Nebius Token Factory

This document is the **umbrella plan**. It fixes the repo layout, the contracts between the three blocks and the integration milestone, so that each block can get its own detailed plan (01/02/03) and be built separately.

**Reference:** the concept plan, [`buddy-capability-plan.md`](buddy-capability-plan.md), also in Notion.

**Repo:** `lucazagaia/vibeLabs`, checked out at `/Users/LucaZagaia/AI_Projects/Nebius_Hack.md`. It's on `main`, in sync with origin, and contains `README.md`, `Siemens.csv` and `Siemens_into.md`.

**Toolchain on this machine:** uv 0.13, Python 3.13.5, Node 22.15, npm 10.9.

---

## Goal: the walking skeleton (definition of done for the basics)
A message typed in the browser travels:

```
Browser (CopilotChat) → Next.js /api/copilotkit (CopilotRuntime) → HttpAgent ──AG-UI/SSE──▶
FastAPI (ag-ui-adk) → ADK LlmAgent "data_buddy" | "research_buddy" (picked by a UI switch) → LiteLlm("nebius/…") → Token Factory → Nemotron
```

…and the reply streams back. The skeleton proves three mechanisms the real app depends on:
1. **Text streaming:** Buddy answers in the chat.
2. **Backend tool round trip:** the `dataset_info()` tool on the ADK agent reads `Siemens.csv` and returns row and column counts. Buddy reports "10,000 suppliers, 46 columns".
3. **Frontend tool round trip:** `show_notice(text)` is registered in the browser. When Buddy calls it, a card renders on the dashboard placeholder.

**Out of scope for the basics:**
- Data Buddy and Research Buddy logic
- panels W1–W12
- the UI-state store
- `/api/data/*`

Each of those gets a later plan.

## Target repo layout

```
vibeLabs/
├─ README.md                    # how to run agent + web locally
├─ .gitignore                   # .env*, .venv, node_modules, .next, *.sqlite
├─ data/Siemens.csv             # moved from repo root
├─ docs/
│  ├─ Siemens_into.md           # moved (dataset column descriptions)
│  └─ plans/
│     ├─ buddy-capability-plan.md   # concept plan (reference)
│     ├─ 00-basics-architecture.md  # this document
│     ├─ 01-model-layer.md          # written later, per step
│     ├─ 02-adk-backend.md
│     └─ 03-copilotkit-frontend.md
├─ agent/                       # Python 3.13, uv
│  ├─ pyproject.toml
│  ├─ .env.example              # NEBIUS_API_KEY=, SUPERVISOR_MODEL=, …
│  ├─ main.py                   # FastAPI app + ag-ui-adk endpoint + /health
│  ├─ buddy/
│  │  ├─ models.py              # Step 1: get_model(role)
│  │  ├─ data_buddy/agent.py    # Step 2: LlmAgent "data_buddy"
│  │  ├─ research_buddy/agent.py # Step 2: stub LlmAgent "research_buddy"
│  │  └─ tools/basic.py         # Step 2: dataset_info()
│  └─ scripts/smoke_models.py   # Step 1: Token Factory smoke test
└─ web/                         # Next.js (App Router, TS, Tailwind), npm
   ├─ .env.local.example        # AGENT_BASE_URL=http://localhost:8000
   └─ app/
      ├─ api/copilotkit/[[...slug]]/route.ts
      ├─ providers.tsx
      ├─ layout.tsx
      └─ page.tsx               # chat left | dashboard placeholder right
```

## Contracts between the steps (each step can be built against these)

| # | Contract | Producer → consumer | Definition |
|---|---|---|---|
| C1 | **Model factory** | Step 1 → Step 2 | `buddy.models.get_model(role: "supervisor" \| "data" \| "research") -> LiteLlm`. Reads `NEBIUS_API_KEY` and `SUPERVISOR_MODEL` / `DATA_BUDDY_MODEL` / `RESEARCH_BUDDY_MODEL`, each a full LiteLLM string. Defaults: `nebius/nvidia/Nemotron-3_5-Lightning` for supervisor and data, `nebius/nvidia/nemotron-3-super-120b-a12b` for research. |
| C2 | **Agent endpoints** | Step 2 → Step 3 | FastAPI on `http://localhost:8000`. AG-UI `POST /data` (agent `data_buddy`) and `POST /research` (agent `research_buddy`) via `add_adk_fastapi_endpoint`. `GET /health` → `{"ok": true, "agents": [...]}`. |
| C3 | **Runtime route + switch** | Step 3 internal | `web/app/api/copilotkit/[[...slug]]/route.ts` registers **both** agents: `CopilotRuntime({ agents: { data_buddy: new HttpAgent({ url: `${AGENT_BASE_URL}/data` }), research_buddy: new HttpAgent({ url: `${AGENT_BASE_URL}/research` }) }, runner: new InMemoryAgentRunner() })` and `createCopilotRuntimeHandler({ basePath: "/api/copilotkit" })`. A **deterministic switch button** (Data ⇄ Research) sets the chat's `agentId`. There's no orchestrator. |
| C4 | **Skeleton tools** | Step 2 ↔ Step 3 | Backend: `dataset_info() -> {rows, columns}`. Frontend: `show_notice({ text: string })`, registered with `useFrontendTool`. The names and schemas are fixed now, so both sides can be built independently. |

**Secrets:**
- Every developer creates their own Token Factory key.
- `NEBIUS_API_KEY` lives only in `agent/.env`, which is gitignored. Only `.env.example` files are committed.
- The web app never sees the key, because the model is called from the agent.

## Working mode: one step at a time, with a checkpoint after each
Nothing runs in one go. Every step (including writing its detailed plan) ends at a **checkpoint ⏸**, where work stops:
1. **Show:** what was built, what was verified (with real output), and what didn't work.
2. **Decisions:** the open questions that came up, for example which model to use, a version pin, or a file layout.
3. **Questions:** Luca can ask anything, change direction, or adjust the next step's plan.
4. **Go:** the next step starts only after Luca explicitly says so.

Each step also runs in two halves, each with its own pause. First the step's detailed plan is written (**pause for approval**). Then it's built (**pause at the checkpoint**).

## The three steps

### Step 1: Model layer (LiteLLM → Nemotron on Token Factory)
- **Builds:** `agent/buddy/models.py` (C1) and `agent/scripts/smoke_models.py`.
- **The smoke script:**
  1. Lists the available models (`GET /v1/models?verbose=true`).
  2. For each Nemotron candidate, runs one plain completion and one forced tool call through LiteLLM's `nebius/` provider.
  3. Prints latency and whether the tool arguments are valid JSON.
- **Decides:**
  - which Nemotron IDs actually support tool calling
  - how reasoning output (`reasoning_content` or think tags) comes back, and how to keep it out of the chat
  - the default model per role
- **Done when:** both default models return a valid tool call, and `get_model()` works from a plain `LlmAgent` in `adk run`.
- **Dependencies:** none. This step can start immediately and needs only the API key.
- **⏸ Checkpoint 1:**
  - Show the smoke-test table (model, tool call OK, latency, how reasoning comes back) and the chosen default models.
  - **Questions to settle:** keep Lightning for the supervisor? Is the reasoning output acceptable?
  - Wait for go before Step 2.

### Step 2: ADK backend
- **Builds:**
  - `agent/` as a uv project, pinned to `google-adk 2.12.x`, `ag-ui-adk 0.10.x`, `litellm 1.106.x`, `fastapi 0.143.x` and `uvicorn`. Confirm that ag-ui-adk's declared google-adk range allows 2.12.
  - `main.py`: FastAPI app serving two agents. Each is wrapped in an ADK `App` with `ResumabilityConfig(is_resumable=True)` and in `ADKAgent.from_app(...)`, and mounted with `add_adk_fastapi_endpoint` at `/data` and `/research`. Plus `/health`.
  - `buddy/data_buddy/agent.py`: `LlmAgent("data_buddy")` with `dataset_info` (C4) and `AGUIToolset()`, so it receives frontend tools.
  - `buddy/research_buddy/agent.py`: a stub `LlmAgent("research_buddy")` (Super model, no tools yet) that proves the switch.
- **Decision (18 Oct):** no orchestrator for now; a UI switch picks the agent. The supervisor (`sub_agents` + `mode="single_turn"`) is parked until the end, if there's time. See `02-adk-backend.md`.
- **Done when:**
  - `uv run uvicorn main:app --port 8000` starts
  - `agui_smoke.py` streams `RUN_STARTED` … `TEXT_MESSAGE_*` … `RUN_FINISHED` from both `/data` and `/research`
  - `dataset_info` gets called when you ask about the dataset, and a `show_notice` frontend tool call is emitted
- **Dependencies:** C1. Until Step 1 lands, `get_model()` can temporarily return any working LiteLLM model.
- **⏸ Checkpoint 2:**
  - Show the streamed AG-UI events for scenarios S1–S4 (see `02-adk-backend.md`).
  - **Questions to settle:** are in-memory sessions fine for now? Separate chat thread per agent when switching? Research Buddy's model?
  - Wait for go before Step 3.

### Step 3: CopilotKit frontend (basic interface over AG-UI)
- **Builds:**
  - `web/` via `create-next-app`: TypeScript, App Router, Tailwind, npm.
  - `@copilotkit/react-core`, `@copilotkit/runtime` (1.79.x) and `@ag-ui/client` (1.0.x).
  - `route.ts` (C3).
  - `providers.tsx`: `CopilotKit` from `@copilotkit/react-core/v2` with `runtimeUrl="/api/copilotkit"`.
  - `layout.tsx`, importing `@copilotkit/react-core/v2/styles.css`.
  - `page.tsx`: a two-column skeleton. The left side has the CopilotKit chat with a **Data ⇄ Research switch button** above it, which sets `agentId`. The right side is an empty "dashboard" area where `show_notice` cards render (C4).
- **Done when:**
  - `npm run dev` serves `:3000`
  - chatting streams replies from whichever agent the switch selects
  - the CopilotKit Inspector shows AG-UI events for `data_buddy` and `research_buddy`
- **Dependencies:** C2 for real answers. The UI work can proceed against any AG-UI agent before Step 2 is ready.
- **⏸ Checkpoint 3:**
  - Show a screenshot of the chat + dashboard skeleton, a streamed reply, and the Inspector events.
  - **Questions to settle:** layout and look, and whether the chat component is the right one.
  - Wait for go before Step 4.

### Step 4: Integration milestone (after Steps 1–3)
Run both services and walk the skeleton checklist:
1. "Hi" gets a streamed reply from Data Buddy. Flip the switch, and "Hi" gets a reply from Research Buddy.
2. "How many suppliers are in the dataset?" (on Data) calls `dataset_info`, and Data Buddy answers 10,000.
3. "Show a notice saying hello" calls `show_notice`, and a card appears on the right.
4. The Inspector shows every event, and the agent's terminal shows the LiteLLM call to `nebius/…`.

Then update `README.md` with run instructions.
- **⏸ Checkpoint 4 (final):** a demo of the four checks.
  - **Questions to settle:** what to tackle first in the Data Buddy work (P0 in the concept plan), and whether to push the branch and open a PR.

## Order and splitting
- **Dependency graph:** Step 1 ─(C1)→ Step 2 ─(C2)→ Step 4, and Step 3 ─(C2)→ Step 4. Steps 1 and 3 have no dependencies, and Step 2 only needs the C1 interface.
- **Solo order (Luca):** 1 → ⏸ → 2 → ⏸ → 3 → ⏸ → 4 → ⏸. The model risk is the biggest unknown, so it's settled first.
- **Parallel option:** steps 1 and 3 at the same time, then 2, then 4.
- **Per-step plans:** each step gets its own plan document (`docs/plans/01…03`). It holds:
  - exact files and code outline
  - commands
  - pitfalls
  - its own verification

## Risks to watch
- **ag-ui-adk 0.10 vs google-adk 2.12 compatibility.** Pin them together and check the declared range.
- **Nemotron tool calling and reasoning output through LiteLLM.** Step 1 settles this.
- **CopilotKit v2 import paths** (`@copilotkit/react-core/v2`, `@copilotkit/runtime/v2`). The docs show both v1 and v2 APIs, so use v2 consistently.
- **Python adapter sub-agent events.** The stretch item in Step 2 covers this.

## Verification (of this umbrella plan)
- Each step's "Done when" passes on its own.
- Step 4's four-point checklist passes end to end on a fresh clone, following only `README.md`.

## Immediate actions after approval (documentation only, no app code)
1. Create a branch `chore/plans-and-layout`.
2. Save the reference plan as `docs/plans/buddy-capability-plan.md`, and this umbrella plan as `docs/plans/00-basics-architecture.md`.
3. Commit locally. Pushing happens only when Luca says so.
4. **⏸ Checkpoint 0:** stop and report what was saved. Wait for Luca's go before writing the detailed Step 1 plan (`01-model-layer.md`), which then gets its own approval pause.
