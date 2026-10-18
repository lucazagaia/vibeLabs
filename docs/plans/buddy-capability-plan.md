# Buddy: capability plan (Google ADK supervisor + Data/Research Buddies, CopilotKit frontend, Nemotron)

> **Decision updates (18 Oct), which supersede the matching parts below:**
> - **No orchestrator for now.** The user picks **Data Buddy ⇄ Research Buddy with a deterministic switch button**. The two agents are served separately (`/data`, `/research`). The supervisor in sections 2–3 is parked until the end, if there's time.
> - **If the supervisor comes back,** use ADK 2.x `sub_agents=[...]` with `mode="single_turn"` rather than `AgentTool`. google-adk 2.12 marks direct `AgentTool` use as discouraged.
> - **The Python ag-ui-adk adapter emits no `SUBAGENT_*` events.** Progress chips would come from rendering the delegation tool call.
> - **Frontend tools need an `AGUIToolset()` placeholder** on each agent that should see them.
> - Details: `00-basics-architecture.md` and `02-adk-backend.md`.

## Context
vibeLabs is building the Siemens "Supplier Risk Intelligence" app for the Nebius hackathon. For now the UI is deliberately simple: **a chat panel plus an adaptive dashboard** over 10,000 suppliers from `Siemens.csv`. The zoomable "world" view is parked for later. The user chats with one supervisor, **Buddy**. It delegates to two specialists: the **Data Buddy**, planned in detail here, and the **Research Buddy**, which comes later. The right reusable panels appear on the dashboard.

The dataset has 19 risk scores (0 = no risk, 100 = maximum risk) with Low/Medium/High/Critical levels, 4 operational metrics, Sourcing Risk Level and Supply Chain Complexity. It has no category, region or tier columns. Supplier names are anonymized (for example "Apex Technologies 491").

---

## 1. Feasibility: ADK + CopilotKit (confirmed in the CopilotKit docs)
- CopilotKit has an official **Google ADK integration** over the open **AG-UI protocol** (docs.copilotkit.ai/integrations/adk).
- **Backend:** `uv add ag-ui-adk google-adk uvicorn fastapi`. Wrap the ADK `LlmAgent` in `ADKAgent(...)` and expose it with `add_adk_fastapi_endpoint(app, adk_agent, path=...)`.
- **Frontend bridge:** in Next.js, `app/api/copilotkit/[[...slug]]/route.ts` creates a `CopilotRuntime` whose `agents` map points at the ADK endpoints through `HttpAgent` from `@ag-ui/client`.
- **These features work with ADK:**
  - **Frontend tools.** The ADK agent can call browser-side tools. This is exactly the "pop the right window" mechanism.
  - **Generative UI** (tool calls render as React components).
  - **Human in the loop** (weights panel, clarify picker).
  - **State into each run.** `add_adk_fastapi_endpoint(..., extract_state_from_request=...)` can inject server-side state into every run, and ag-ui-adk exposes `/agents/state` to reload a thread's state and messages. We use both for the persisted UI-state store (section 3b).
- **Multi-agent inside ADK:** the ag-ui ADK adapter supports `sub_agents` (hand-offs) and `AgentTool` (delegation, with `SUBAGENT_*` progress events). Frontend tools attach to the **root** agent, so the root supervisor owns the UI. The frontend needs only **one** CopilotKit agent (`buddy`).
- **Model:** Nemotron on Nebius Token Factory. See section 1b.

## 1b. Nemotron compatibility (checked against the Token Factory docs)
The answer is yes, and the whole chain uses documented, official paths:

```
CopilotKit (React) ──AG-UI──▶ ag-ui-adk ──▶ Google ADK LlmAgent ──LiteLlm("nebius/…")──▶ Token Factory ──▶ Nemotron
```

- **ADK → Token Factory is an official integration** (docs.tokenfactory.nebius.com/integrations/agents/google-adk). It uses `from google.adk.models.lite_llm import LiteLlm`, then `LiteLlm(model="nebius/<model-id>")` with `NEBIUS_API_KEY` in the environment, and `pip install google-adk litellm`. No custom base URL is needed, because LiteLLM's `nebius/` provider handles it. The raw API is OpenAI-compatible at `https://api.tokenfactory.nebius.com/v1/`.
- **Tool calling is supported** (docs: "Function calling & Tools") in the OpenAI function-calling format, with `tool_choice` set to `auto` or a forced function. This is what both kinds of tool need:
  - ADK backend tools (the pandas data tools)
  - CopilotKit frontend tools (the windows), which ag-ui-adk forwards to the model as ordinary tool schemas
- **CopilotKit doesn't care which model runs.** The model lives behind ADK, and the frontend only speaks AG-UI, so nothing in the frontend changes.
- **Nemotron models on Token Factory Serverless** (from the Aug 2026 deprecation notice, where they're listed as recommended replacements):
  - `nvidia/nemotron-3-super-120b-a12b`: a large MoE built for agentic reasoning and tool use. **Use it for Research Buddy**, which does long planning and multi-step crawling, and as the Data Buddy fallback when routing quality matters.
  - `nvidia/Nemotron-3_5-Lightning`: a fast tier. **Use it for Data Buddy**, which needs quick routing to tools and windows and short narration.
  - Deprecated, so don't use: `nvidia/Llama-3_1-Nemotron-Ultra-253B-v1` and `nvidia/Nemotron-3-Nano-Omni`. Both were removed from Serverless on Aug 31, 2026.
  - The hackathon materials also mention **Nemotron 3.5 Super VL** on Token Factory. If it shows up in our model list, it's a good option for Research Buddy, because it can read page screenshots and PDFs.
- **Model choice stays configurable:** `DATA_BUDDY_MODEL` and `RESEARCH_BUDDY_MODEL` environment variables, so we can swap tiers without code changes.

**Risks and how to handle them:**
1. **Tool support varies by model.** The docs confirm function calling in general but don't list which models support it. Before building, run `curl -s 'https://api.tokenfactory.nebius.com/v1/models?verbose=true' -H "Authorization: Bearer $NEBIUS_API_KEY"` and a one-tool smoke test per Nemotron model. Fall back to the Super model if Lightning routes poorly.
2. **Reasoning output.** Nemotron reasoning modes can emit thinking text. Set the prompt or system flag to keep answers short, and make sure only the final text reaches the chat. Check how LiteLLM handles `reasoning_content`.
3. **Too many tools.** Data Buddy has 9 data tools and 6 frontend tools. Keep the descriptions crisp, and consider forcing `open_window` after a data tool returns, so the model never answers with numbers but no window.
4. **Grounding stays deterministic.** The model only routes and narrates, and the numbers come from pandas, so the model choice barely affects correctness.

## 2. Architecture: chat + adaptive dashboard, one supervisor, two delegated buddies

```
┌──────────────────────── Next.js (web/) ────────────────────────┐
│  [ Chat with Buddy ] │ [ Adaptive dashboard: panel grid W1–W12 ] │
│  progress chips per sub-agent   compare tray strip on top       │
│  Frontend tools: open_window, close_window, clear_dashboard,    │
│                  add_to_compare, set_weights                    │
│  /api/copilotkit → CopilotRuntime { buddy: HttpAgent(:8000/) }  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ AG-UI (SSE): text, tool calls, sub-agent events; UI state injected at run start
┌───────────────────────────────▼──── FastAPI (agent/) ───────────┐
│  ADKAgent(root = supervisor "buddy", LlmAgent)                  │
│   ├─ receives the frontend tools (ag-ui-adk attaches them to   │
│   │   the ROOT agent)                                          │
│   ├─ AgentTool(data_buddy)     → pandas tools over Siemens.csv  │
│   └─ AgentTool(research_buddy) → web search / crawl tools       │
│  Run start: extract_state_from_request → latest UI state (RO)   │
│  /api/ui-state/{thread}  GET/PATCH (SQLite) · /api/data/*      │
└─────────────────────────────────────────────────────────────────┘
```

**Repo layout** (in `lucazagaia/vibeLabs`):
- `agent/`: a Python project using uv.
  - `main.py`: FastAPI with one endpoint, `/`.
  - `buddy/supervisor.py`: the root LlmAgent, its routing instruction, and the two AgentTools.
  - `buddy/data_buddy/`:
    - `agent.py`
    - `tools.py`: pandas tools.
    - `scoring.py`: pillars, percentiles, explain.
  - `buddy/research_buddy/`: later.
  - `data/Siemens.csv`.
- `web/`: Next.js + CopilotKit. It holds:
  - a two-column layout: chat on the left, dashboard on the right
  - `components/panels/*`
  - the dashboard layout logic
  - the frontend-tool registrations

## 3. Orchestration: a supervisor delegating to Data Buddy and Research Buddy

**Decision:** one supervisor agent ("Buddy") is the only voice the user talks to. It delegates to **Data Buddy** or **Research Buddy** as `AgentTool`s, gets their result back, then opens the right window(s) and answers. This gives the nicer user experience you asked for: one chat, one personality, and the user never has to pick an agent.

**Why `AgentTool` (delegation) rather than `sub_agents` (transfer):**
- With **transfer**, the sub-agent takes over the conversation. In ag-ui-adk, frontend tools attach to the **root** agent, so a transferred Data Buddy couldn't open windows, and handing control back is fuzzy.
- With **AgentTool**, control always returns to the supervisor. The supervisor owns the UI tools and gives the final answer. The ag-ui ADK adapter reports this as "delegation" and emits `SUBAGENT_STARTED/FINISHED` progress events (confirmed in the JS adapter; still to verify in the Python adapter).

**Turn flow, for example "Best 3 suppliers with the lowest financial risk":**
1. The supervisor classifies the request as data and calls the `data_buddy` tool with the request plus context (tray, weights, what's on screen).
2. Data Buddy calls `rank_suppliers(pillar="Financial", n=3)` to reason over the result. It returns a compact summary plus a **query spec**: `{query: {op: "rank", pillar: "Financial", n: 3}, ids: [...], headline: "..."}`.
3. Data Buddy returns `{query, suggested_windows: ["podium", "radar"], summary}` to the supervisor.
4. The supervisor calls the frontend tools `open_window("podium", query)` and `open_window("radar", query)`, then writes a 1–2 sentence answer. The panels appear on the dashboard.
5. The browser applies `open_window` through `applyCommand`, which persists the panel and its query to the UI-state store. It then fetches the numbers from `GET /api/data/rank?pillar=Financial&n=3`, which runs the same pandas function the agent used. **Numbers never pass through an LLM, and the dashboard survives a reload.**

**Routing rules in the supervisor's instruction:**
- **Questions about suppliers in the dataset, rankings, comparisons and explanations** → `data_buddy`.
- **A real company name, news, red flags, "research", "what's happening with X"** → `research_buddy`.
- **Both, e.g. "Is SUPP_00731 safe? Also check news on Knorr-Bremse"** → call both in sequence, then open both windows.
- **UI-only requests ("clear the dashboard", "show my tray")** → frontend tools directly, without delegating.

**Long-running research (the main trade-off):** an AgentTool call blocks the supervisor's turn, and research can take minutes.
- **P0:** research runs synchronously and shows a live progress chip ("Research Buddy: searching news… found 3 red flags… writing report").
- **P1:** make research asynchronous. The supervisor calls `start_research(company, question)`, which launches a background task and returns a `job_id` immediately. The job is recorded in the UI-state store via `applyCommand`, and the browser follows progress through `GET /api/research/jobs/{job_id}` (polling or SSE) into a Research Report window, so the user keeps chatting about data meanwhile.

**Latency:** delegation adds one model hop (supervisor → buddy → supervisor). To keep it fast, run the supervisor and Data Buddy on `Nemotron-3_5-Lightning`, and Research Buddy on `nemotron-3-super-120b-a12b`.

**Caveat:** dataset names are anonymized, while research needs **real company names**. Research requests therefore carry the name the user types. W3 gets a "link a real company" field, so a buyer can attach a real company to an anonymized supplier and research it.

## 3b. State: a persisted UI-state store, written on every click and read by the agent at run start

**The problem with plain AG-UI shared state:**
- CopilotKit's `agent.setState()` only reaches the backend on the **next agent run** (the docs say it "will be used next time the agent runs").
- ADK persists session state only **during runs**.
- So a click followed by a reload, before any chat message, is lost, and between runs the backend never knows what the user did. That's the issue you hit before.

**Decision:** keep **one owner of truth: a small UI-state store on the backend, keyed by `thread_id`**. The browser is a fast, optimistic cache in front of it. AG-UI state is used only as the **transport** into each run, never as the place state lives.

```
click / agent command
      │
      ▼
browser applyCommand() ──► local store updates instantly (optimistic UI)
      │
      └─► PATCH /api/ui-state/{thread_id}   (debounced ~150 ms, version++)
                     │
                     ▼
            UI-state store (SQLite)  ◄── GET on page load (rehydrate after reload)
                     │
                     ▼
agent run ─► extract_state_from_request() loads the latest store → state.ui
             (server copy overrides the client snapshot; no stale race)
```

**What the store holds (compact; IDs and specs, never data rows):**
- `compare_tray`: ≤20 IDs
- `selected_supplier`
- `weights`: preset + pillar weights
- `panels`: type, query spec, size, pinned flag
- `linked_companies`
- `research_jobs` (P2)
- `recent_actions`: a ring buffer of the last 10 user actions, for example "pinned W2", "added SUPP_00450 to tray", "clicked SUPP_00012 in podium". **This is how the agent knows what the user just clicked.**
- `version`: increases on every write, so out-of-order PATCHes are ignored.

**Write path, the same for clicks and the agent:**
- Every mutation goes through **one browser function, `applyCommand(cmd)`**. It updates the local store and persists the change with a PATCH.
- **User clicks** call it directly.
- **Agent changes** arrive as **frontend tool calls** (`open_window`, `add_to_compare`, `set_weights`, `clear_dashboard`, `link_company`) and also call `applyCommand`.
- So there's one code path and one validation (for example, the 20-supplier tray limit). The agent never writes state any other way and never emits `STATE_SNAPSHOT`/`STATE_DELTA`.

**Read paths:**
- **Page load or reload:** the `thread_id` lives in the URL and localStorage. The browser loads `GET /api/ui-state/{thread_id}` and the chat history (ADK `DatabaseSessionService` on SQLite, read through ag-ui-adk's `/agents/state` endpoint). Dashboard, tray and chat all come back exactly as they were.
- **Agent run:** `add_adk_fastapi_endpoint(..., extract_state_from_request=load_ui_state)` reads the store at the start of each run and injects it as `state.ui`. The agent always sees the latest persisted clicks, even ones made before a reload, and treats `state.ui` as read-only context.
- **Clicks the agent should react to right away** ("Ask about this", "Explain this panel") write `applyCommand` first, then start a run with a short hint message.

**Data still never travels through state or the LLM:** panels hold a **query spec** and fetch numbers from `GET /api/data/{op}`, which uses the same `tools.py` functions the agent calls.

**Hackathon scope:**
- One SQLite file for both the UI-state table and ADK sessions.
- No auth beyond a per-browser `thread_id` (the jury login is handled at the app level).
- PATCH sends the full state (it's small) with a version check, so no diff protocol is needed.

## 4. Data Buddy: data tools (Python, deterministic, in `tools.py`)

| Tool | Input | Returns |
|---|---|---|
| `filter_suppliers` | conditions on any metric or level, sourcing risk, complexity | matching IDs + count |
| `rank_suppliers` | metric **or** pillar, direction, n, filter, weights | top-n rows with values + rank |
| `get_supplier` | ID | full row + pillar scores + percentiles |
| `compare_suppliers` | 2–20 IDs | aligned rows, best/worst per metric, pillar scores |
| `explain_score` | ID | each pillar's contribution vs average + red flags (Critical metrics) |
| `find_alternatives` | ID, n, constraint | most similar profiles that beat it on the constraint |
| `distribution` | metric, IDs to mark | histogram bins + percentiles |
| `segment_stats` | group by (sourcing × complexity, level) | counts, averages, share Critical |
| `pareto` | two metrics, filter | points + frontier IDs |

**Pillars:**
- **Financial:** Financial_Health, Credit_Rating
- **Operational & Quality:** Operational_Resilience, Quality_Risk, Safety_Incident, Labor_Stability, Sub_Tier_Visibility
- **Compliance & Governance:** Compliance_Risk, Governance_Risk, ESG_Performance
- **Geopolitical & Environmental:** Geopolitical_Risk, Political_Stability, Environmental_Exposure
- **Digital:** Digital_Security
- **Reputation & Intelligence:** Media_Sentiment, Market_Sentiment, External_Intelligence, Industry_Benchmark
- **Delivery:** Delivery Rating and Confirmation Rate (both inverted) and Order Change Rate

Total_Risk_Index stays the official overall score. Pillars drive explanations and weighted re-ranking.

## 5. Panel library (React dashboard panels, opened via frontend tools)

| # | Panel | Shows | Takes |
|---|---|---|---|
| W1 | Comparison Matrix | heatmap, suppliers × metrics by pillar, best per row outlined | 2–20 IDs |
| W2 | Podium / Top-N Cards | 1–5 cards side by side, deciding metric emphasized | ranked rows + focus metric |
| W3 | Supplier Profile | score + level, pillar radar, red flags, operational metrics, research badge | 1 ID |
| W4 | Score Breakdown | waterfall "why this score" | `explain_score` |
| W5 | Radar Overlay | 2–5 suppliers on one radar | IDs |
| W6 | Distribution | histogram with suppliers marked | metric + IDs |
| W7 | Scatter / Pareto | two metrics, frontier highlighted | points |
| W8 | Ranked List | compact sortable table, add-to-compare | rows |
| W9 | Segment Summary | stats per segment (sourcing risk × complexity) | `segment_stats` |
| W10 | Shortlist Memo | generated justification, exportable | IDs + rationale |
| W11 | Weights Panel (human in the loop) | pillar sliders and presets; re-ranks open windows | weights |
| W12 | Clarify Picker (human in the loop) | quick choice for ambiguous requests | options |

**Frontend tools (owned by the supervisor; the buddies return query specs and suggested windows). They are the agent's only way to change state:**
- `open_window(type, query)`, which reuses a window of the same type if one is open; the window fetches its data from `/api/data/*` using the query spec
- `close_window(id)`
- `clear_dashboard()`
- `add_to_compare(ids)` / `remove_from_compare(ids)`
- `set_weights(preset | weights)`
- `link_company(id, name)`

**Adaptive dashboard (replaces the floating-window manager):**
- **Layout:** a responsive grid on the right. Chat stays on the left, the compare tray is a thin strip above the grid, and there's an empty-state hint ("Ask Buddy something…").
- **New panels:** a new answer's panels go to the top and are briefly highlighted. Older ones move down.
- **Reuse:** if a panel of the same type is already showing, it's updated in place instead of duplicated.
- **Sizes come from the panel type:**
  - wide: W1 matrix, W8 list, W7 scatter
  - medium: W2 podium, W3 profile, W4 breakdown
  - small: W5, W6, W9
- **Limit:** at most 4 panels. The oldest unpinned panel drops off first.
- **Panel controls:** pin, close, and "Ask about this", which puts the panel into the chat context.
- **Clearing:** "Clear dashboard" resets to the empty state.

## 6. Use cases → tools → windows

| # | User says | Data tools | Dashboard panels |
|---|---|---|---|
| 1 | "Compare these 20 suppliers" | `compare_suppliers` | W1 (+ W7) |
| 2 | "Best 3 with the lowest financial risk" | `rank_suppliers(pillar=Financial, n=3)` | W2 + W5 |
| 3 | "Why is SUPP_00018's risk so high?" | `explain_score` | W4 (+ W3) |
| 4 | "Tell me about SUPP_00001" | `get_supplier` | W3 |
| 5 | "Alternatives to SUPP_00001 with lower financial risk" | `find_alternatives` | W2 / W1 |
| 6 | "How does SUPP_00450 rank on quality vs everyone?" | `distribution` | W6 |
| 7 | "Great delivery **and** low total risk?" | `pareto` | W7 + W8 |
| 8 | "High sourcing risk with complex chains" | `filter_suppliers` | W8 |
| 9 | "Which segment is the riskiest?" | `segment_stats` | W9 |
| 10 | "Any Critical compliance or governance?" | `filter_suppliers` | W8 with flags |
| 11 | "Safety-critical part, weigh quality higher" | — | W11, then re-rank |
| 12 | "Where is high-risk spend concentrated?" | `pareto(PO volume, TRI)` | W7 + W8 |
| 13 | "Write up why I chose SUPP_00731" | `compare_suppliers` + LLM | W10 |
| 14 | "Who is the most reliable?" (ambiguous) | — | W12 |
| 15 | "Research Knorr-Bremse deeper" | supervisor → `research_buddy` | Research Report window (+ progress chip) |

## 7. Guardrails
- Numbers come only from tool output. The LLM routes and narrates and never computes.
- An unknown ID or an empty result gives a friendly message plus the closest suggestion.
- Compare is capped at 20.
- Every window has a footer: "source: dataset · n rows".

## 8. Priorities
- **P0:**
  - ADK supervisor + `data_buddy` AgentTool on one endpoint + CopilotKit route + one frontend tool round trip
  - UI-state store (SQLite) + `PATCH`/`GET /api/ui-state` + `extract_state_from_request`; `applyCommand()` in the browser; `/api/data/*` endpoints that panels call by query spec
  - `filter`, `rank`, `get`, `compare` and `explain`
  - W1, W2, W3, W4 and W8
  - chat + adaptive dashboard grid and compare tray strip
- **P1:**
  - W5, W6, W7, W10 and W11
  - `set_weights` / tray commands as frontend tools
  - Research Buddy stub behind the supervisor (returns a canned report window)
- **P2:**
  - W9, W12, `find_alternatives`
  - asynchronous research jobs (`start_research` + a job-status endpoint, with jobs tracked in the UI-state store)

## Verification
0. **Model smoke test:** list the models with `?verbose=true`. Then run `adk run` with a one-tool agent on `nebius/nvidia/Nemotron-3_5-Lightning` and on `nebius/nvidia/nemotron-3-super-120b-a12b`. Both should call the tool with valid arguments.
1. **Smoke test:** the ADK endpoint is reachable, and in the CopilotKit Inspector, AG-UI events flow for `buddy`, including the delegation to `data_buddy`.
2. **Frontend tool round trip:** "Tell me about SUPP_00001" opens W3 with values that match row 1 of the CSV.
3. **Use cases:** run all 15 prompts. Each should open the expected window(s), with no duplicates.
4. **Pandas check:** spot-check 5 answers against a notebook (ranks, values and pillar scores).
5. **Edge cases:** an unknown ID, 21 IDs, zero matches, an ambiguous request.
6. **Click persistence:** add a supplier to the tray, pin a panel, then reload *without* chatting. The tray and dashboard come back. Then ask "what's in my tray?". The agent answers correctly, and `recent_actions` mentions the click.
7. **Routing:** data prompts go to `data_buddy`, research prompts go to `research_buddy`, mixed prompts call both, and UI-only prompts don't delegate. Window numbers come from `/api/data/*` responses, not from LLM text, and the agent never emits state events.

---
*Also published in Notion as "Buddy: capability plan".*
