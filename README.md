# vibeLabs: Supplier Risk Buddy

Team **vibeLabs** (Alex, Adham, Luca) · Nebius hackathon, Berlin · Siemens challenge *"Smart Supplier Selection for Trains"*.

A chat + dashboard app for rail procurement buyers. Two AI agents work on a dataset of 10,000 anonymized suppliers:
- **Data Buddy** answers questions about the supplier data.
- **Research Buddy** will research real companies (it's a stub for now).

A switch in the UI picks which one you talk to, and both can put cards on the dashboard.

```
Browser (Next.js + CopilotKit)            web/   :3000
  chat + Data ⇄ Research switch | dashboard
        │  /api/copilotkit  (CopilotKit runtime, server-side)
        ▼  AG-UI over SSE
FastAPI + ag-ui-adk                       agent/ :8000
  /data      → Data Buddy      (Google ADK LlmAgent, tool: dataset_info)
  /research  → Research Buddy  (Google ADK LlmAgent, stub)
        │  LiteLLM  ("nebius/…")
        ▼
Nebius Token Factory → NVIDIA Nemotron (3.5 Lightning / 3 Super)
```

## Prerequisites
- **uv** (Python 3.13 is installed automatically): `brew install uv`
- **Node.js 22+** and npm
- A **Nebius Token Factory API key**, created at tokenfactory.nebius.com → API keys. Everyone uses their own key.

## One-time setup

```bash
git clone https://github.com/lucazagaia/vibeLabs.git
cd vibeLabs
```

**Agent (Python)**

```bash
cd agent
uv sync
cp .env.example .env
```

Then open `agent/.env` and paste your key after `NEBIUS_API_KEY=`.
- Put it **only** in `.env`, which is gitignored. Never put it in `.env.example`, which is committed.
- The other values (models, reasoning levels, base URL) have working defaults.

**Web (Next.js)**

```bash
cd web
npm ci
cp .env.local.example .env.local
```

`web/.env.local` holds no secrets. It sets the agent URL and turns off CopilotKit telemetry.

## Run (two terminals)

```bash
# Terminal 1: agents on http://localhost:8000
cd agent && uv run uvicorn main:app --port 8000
```

```bash
# Terminal 2: web app on http://localhost:3000
cd web && npm run dev
```

Open http://localhost:3000.

**Things to try:**
- **Data Buddy:** "How many suppliers are in the dataset?" It calls the `dataset_info` tool and answers 10,000.
- **Data Buddy:** "Show a notice on the dashboard saying hello." A card appears on the right.
- **Research Buddy** (flip the switch): "Hi! Who are you?" It has its own, separate thread.

## Smoke tests (no browser needed)

```bash
cd agent
uv run python scripts/smoke_models.py           # Nemotron on Token Factory: tool calls, streaming, reasoning
uv run python scripts/agui_smoke.py             # needs the agent server running: S1–S4 against /data and /research
uv run adk run scripts/adk_hello                # interactive ADK agent in the terminal (type "exit" to quit)
```

## Repo layout

```
agent/                 Python: Google ADK agents served over AG-UI (FastAPI)
  main.py              /data, /research, /health
  buddy/models.py      get_model(role): the only place model IDs and reasoning levels live
  buddy/data_buddy/    Data Buddy agent
  buddy/research_buddy/ Research Buddy agent (stub)
  buddy/tools/         backend tools (dataset_info)
  scripts/             smoke tests and the adk_hello demo agent
web/                   Next.js 16 + CopilotKit v2
  app/api/copilotkit/  CopilotKit runtime registering both agents
  components/          AgentSwitch, ChatPane, Dashboard, ShowNoticeTool
data/Siemens.csv       the challenge dataset (10,000 suppliers × 46 columns)
docs/Siemens_into.md   column descriptions
docs/plans/            concept plan + step-by-step build plans (00–04)
```

## Configuration
- **`agent/.env`:**
  - `NEBIUS_API_KEY`
  - `NEBIUS_API_BASE`, default `https://api.tokenfactory.nebius.com/v1`
  - per-role models: `DATA_BUDDY_MODEL`, `RESEARCH_BUDDY_MODEL`
  - reasoning levels: `DATA_BUDDY_REASONING=none`, `RESEARCH_BUDDY_REASONING=medium`
- **`web/.env.local`:**
  - `AGENT_BASE_URL` (server-only)
  - `COPILOTKIT_TELEMETRY_DISABLED=true`

Restart the server after changing an env file.

## Troubleshooting
These are all things we actually ran into:

| Symptom | Cause | Fix |
|---|---|---|
| `NEBIUS_API_KEY missing` | No `agent/.env` | `cp agent/.env.example agent/.env` and add your key |
| Every tool call fails with `No module named 'mcp'` | LiteLLM needs `mcp` for tool calls but doesn't declare it | It's already a dependency, so run `uv sync` |
| The model ignores browser tools like `show_notice` | The agent lacks `AGUIToolset()` | Every agent that should see frontend tools needs `AGUIToolset()` in its `tools` |
| The send button stays grey and the chat never connects | Next 16 *Cache Components*: CopilotKit generates IDs while rendering | Keep `<Providers>` wrapped in `<Suspense>` in `web/app/layout.tsx` |
| Calls go to `api.studio.nebius.ai` | LiteLLM's legacy default base URL for `nebius/` | `NEBIUS_API_BASE` is set explicitly in `buddy/models.py` |
| `address already in use` on :8000 or :3000 | An old server is still running | `lsof -ti tcp:8000 \| xargs kill` (same for 3000) |
| `reasoning_effort` seems to do nothing | LiteLLM drops it for Nebius | It's sent through `extra_body` in `buddy/models.py` |

## Docs and plans
- [Concept plan](docs/plans/buddy-capability-plan.md): the product idea, panels, use cases, state design
- [00 Basics architecture](docs/plans/00-basics-architecture.md): the walking-skeleton plan and contracts
- [01 Model layer](docs/plans/01-model-layer.md) · [02 ADK backend](docs/plans/02-adk-backend.md) · [03 CopilotKit frontend](docs/plans/03-copilotkit-frontend.md) · [04 Integration](docs/plans/04-integration.md)
- Smoke-test record: [agent/scripts/smoke_results.md](agent/scripts/smoke_results.md)
