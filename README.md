# vibeLabs — Feature 2 deep research

Supplier risk deep research for the jury build.

## Research graph

`agent/` and `deep_research/` run the same supplier-risk pipeline:

- Fixed LangGraph nodes: orchestrate → plan → four research lanes → red-flag dives → synthesize, plus one follow-up turn
- Dual Nebius models: Nemotron Super VL for the orchestrator, Nemotron Lightning for lane workers
- Search through LangChain Tavily (`@langchain/tavily` in the UI server, `langchain-tavily` in the CLI)

The test UI talks to the TypeScript graph (`npm run dev:agent`, port 8123). The Python CLI is the same stages for a one-shot report. A later chat UI on main should attach to this LangGraph server the same way CopilotKit does now.

## Python CLI

The one-shot researcher lives in [`deep_research/`](deep_research/):

```bash
cd deep_research
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # or: source .venv/bin/activate
pip install -r requirements.txt
pytest -q
# with NEBIUS_API_KEY and TAVILY_API_KEY set:
python app.py
```

See [`deep_research/README.md`](deep_research/README.md) for Docker, troubleshooting, and cleanup.

## Test UI

Next.js login gate + research page is under `src/`. It streams the TypeScript graph at `LANGGRAPH_DEPLOYMENT_URL` (default `http://localhost:8123`). Shared report types: [`src/lib/research-report.ts`](src/lib/research-report.ts). A later chat UI can attach to that same server.
