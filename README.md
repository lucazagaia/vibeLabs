# vibeLabs: Supplier Risk Buddy

Team **vibeLabs** (Alex, Adham, Luca) · Nebius hackathon, Berlin · Siemens challenge *"Smart Supplier Selection for Trains"*.

A chat + dashboard app for rail procurement buyers. Two AI agents work on a dataset of 10,000 anonymized suppliers:
- **Data Buddy** answers questions about the supplier data.
- **Research Buddy** runs deep supplier-risk research (LangGraph + Tavily).

A switch in the UI picks which one you talk to. Research Buddy streams live activity, sources, and a typed risk report into the chat progress UI.

```
Browser (Next.js + CopilotKit)            web/   :3000
  chat + Data ⇄ Research switch | dashboard
        │  /api/copilotkit  (CopilotKit runtime, server-side)
        ├─ AG-UI over SSE ──────────────► FastAPI + ag-ui-adk   agent/ :8000
        │                                   /data → Data Buddy
        └─ LangGraph Agent ─────────────► TypeScript LangGraph  agent/ :8123
                                            research_agent graph
```

## Prerequisites
- **uv** (Python 3.13 is installed automatically): `brew install uv`
- **Node.js 22+** and npm
- A **Nebius Token Factory API key**, created at tokenfactory.nebius.com → API keys
- A **Tavily API key** (for Research Buddy / deep research)

## One-time setup

```bash
git clone https://github.com/lucazagaia/vibeLabs.git
cd vibeLabs
```

**Agent (Python ADK + TypeScript LangGraph)**

```bash
cd agent
uv sync
cp .env.example .env
# edit .env: NEBIUS_API_KEY, TAVILY_API_KEY
npm ci
```

**Web (Next.js)**

```bash
cd web
npm ci
cp .env.local.example .env.local
```

## Run (three terminals)

```bash
# Terminal 1: Data Buddy ADK on http://localhost:8000
cd agent && uv run uvicorn main:app --port 8000
```

```bash
# Terminal 2: Deep research LangGraph on http://localhost:8123
cd agent && npm run dev
```

```bash
# Terminal 3: web app on http://localhost:3000
cd web && npm run dev
```

Open http://localhost:3000.

**Things to try:**
- **Data Buddy:** "How many suppliers are in the dataset?"
- **Research Buddy** (flip the switch): "Research Knorr-Bremse for supplier risk." Watch live steps, sources, and the report panel.

## Deep research (Python CLI)

One-shot CLI (same pipeline stages) lives in [`deep_research/`](deep_research/):

```bash
cd deep_research
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # NEBIUS_API_KEY + TAVILY_API_KEY
pytest -q
python app.py "Research Siemens Mobility for ESG and compliance risk"
```

## Repo layout

```
agent/                 Python ADK (port 8000) + TypeScript LangGraph (port 8123)
  main.py              /data, /research, /health (ADK)
  buddy/               Data Buddy + card engine
  src/                 LangGraph deep research nodes
  langgraph.json       LangGraph API server config
deep_research/         Python one-shot CLI for the same research pipeline
web/                   Next.js 16 + CopilotKit v2
  app/api/copilotkit/  Registers data_buddy + research_buddy
  components/          AgentSwitch, ChatPane, research progress UI
data/Siemens.csv       challenge dataset
docs/                  plans and specs
```

## Configuration
- **`agent/.env`:**
  - `NEBIUS_API_KEY`, `TAVILY_API_KEY`
  - `NEBIUS_API_BASE`, default `https://api.tokenfactory.nebius.com/v1`
  - per-role ADK models: `DATA_BUDDY_MODEL`, `RESEARCH_BUDDY_MODEL`
  - LangGraph deep research models: `NEBIUS_ORCHESTRATOR_MODEL`, `NEBIUS_WORKER_MODEL`
  - reasoning levels: `DATA_BUDDY_REASONING=low` (at `none`, multi-turn threads broke down after a few comparisons, see 05c), `RESEARCH_BUDDY_REASONING=medium`
- **`web/.env.local`:**
  - `AGENT_BASE_URL` (server-only)
  - `LANGGRAPH_DEPLOYMENT_URL`
  - `COPILOTKIT_TELEMETRY_DISABLED=true`
- **`deep_research/.env`:** see [`deep_research/.env.example`](deep_research/.env.example)

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
- [Concept plan](docs/plans/buddy-capability-plan.md)
- [00 Basics architecture](docs/plans/00-basics-architecture.md)
- [03 CopilotKit frontend](docs/plans/03-copilotkit-frontend.md) · [04 Integration](docs/plans/04-integration.md)
- Deep research CLI: [deep_research/README.md](deep_research/README.md)
