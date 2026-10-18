# Feature 2 — Python deep research agent

CLI for the same fixed-node supplier-risk graph as [`../agent`](../agent). LangGraph stages are orchestrate → plan → four research lanes → red-flag dives → synthesize, plus one follow-up turn. Models are Nebius Token Factory (`langchain-nebius`). Search is LangChain Tavily (`langchain-tavily`).

Rules: cited findings (no invented 0–100 scores), 12-month news preference, and up to three concrete red-flag deep dives. The Next.js harness is only a test UI; it calls the TypeScript copy of this graph.

### Dual-model defaults

| Role | Env var | Default Token Factory id |
| --- | --- | --- |
| Orchestrator (plan, route, synthesize) | `NEBIUS_ORCHESTRATOR_MODEL` | `nvidia/Nemotron-3.5-Super-VL` |
| Workers (lane research) | `NEBIUS_WORKER_MODEL` | `nvidia/Nemotron-3_5-Lightning` |

`NEBIUS_MODEL` still overrides the orchestrator only (legacy alias). Retrieval / embedding rerank is not wired yet.

## Prerequisites

- Python 3.12+
- `NEBIUS_API_KEY` (Token Factory)
- `TAVILY_API_KEY`
- Optional: `NEBIUS_BASE_URL` (default `https://api.tokenfactory.nebius.com/v1`)
- Optional: `NEBIUS_ORCHESTRATOR_MODEL` / `NEBIUS_WORKER_MODEL` (see table above)

Never commit or print either API key.

## Local setup

```bash
cd deep_research
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# edit .env with real keys, then:
#   Windows: Get-Content .env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { Set-Item -Path "env:$($matches[1])" -Value $matches[2] } }
#   macOS/Linux: set -a && source .env && set +a
```

## Tests (no live API calls)

```bash
cd deep_research
pytest -q
```

Tests stub `ChatNebius` and `TavilySearch`. They do not call the network.

## Run one research pass

```bash
python app.py
# or
python app.py "Research Siemens Mobility braking suppliers for ESG and compliance risk"
```

Success criteria:

- Process exits `0`
- Stdout starts exactly with `Deep research report:`
- Report cites sources (URLs) from Tavily rather than generic training-data prose

A full run can take 1–2 minutes and several model calls.

## Docker

```bash
cd deep_research
docker build -t vibe-deep-research .
docker run --rm \
  -e NEBIUS_API_KEY \
  -e TAVILY_API_KEY \
  -e NEBIUS_BASE_URL \
  -e NEBIUS_ORCHESTRATOR_MODEL \
  -e NEBIUS_WORKER_MODEL \
  vibe-deep-research
```

The image does not bake credentials. `CMD` is `python app.py`.

## Verification checklist

1. `pytest -q` — all green, no network
2. `python app.py` with both keys set — prefixed report, exit 0
3. `docker run ...` — same prefixed report

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Missing required environment variable: NEBIUS_API_KEY` | Key not exported in this shell |
| 401 from Token Factory | Bad/expired key, or wrong `NEBIUS_BASE_URL` |
| Empty / generic report with no URLs | `TAVILY_API_KEY` missing or exhausted |
| Slow run | Expected — advanced Tavily depth + multi-step planning |
| Wrong model | Set `NEBIUS_ORCHESTRATOR_MODEL` / `NEBIUS_WORKER_MODEL` to Token Factory ids you can access |

## Cleanup

```bash
deactivate
rm -rf .venv   # Windows: Remove-Item -Recurse -Force .venv
# unset keys in the shell; rotate them if they were ever committed or pasted
```

## Relation to the test UI

[`../agent`](../agent) is the LangGraph server the current CopilotKit page calls. It uses the same nodes, the same two Nebius model ids, and `@langchain/tavily`. This Python app is the one-shot CLI for that pipeline. Shared report types for a future chat UI live in [`../src/lib/research-report.ts`](../src/lib/research-report.ts).
