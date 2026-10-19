<div align="center">

# 🚆 Supplier Risk Buddy

https://github.com/user-attachments/assets/d785ea8b-2f46-4567-b0fe-34ada06ed114

**Supplier Risk Buddy is a workspace for rail buyers with two AI agents inside.** Pick one in the chat:<br>
**Data Buddy** answers questions about the 10,000 suppliers in the dataset, with a chart.<br>
**Research Buddy** checks a real company on the web and writes a sourced risk report.

<sub>Built in one day by team <b>vibeLabs</b> at the <a href="https://luma.com/big-gtc-hack">Nebius Build Week Hackathon with NVIDIA</a> in Berlin (18 October 2026), for the Siemens challenge <i>"Smart Supplier Selection for Trains"</i>.</sub>

[![Nebius Token Factory](https://img.shields.io/badge/Nebius-Token%20Factory-0f1117?style=flat-square)](https://tokenfactory.nebius.com)
[![NVIDIA Nemotron 3.5](https://img.shields.io/badge/NVIDIA-Nemotron%203.5-76b900?style=flat-square&logo=nvidia&logoColor=white)](https://www.nvidia.com/en-us/ai-data-science/foundation-models/nemotron/)
[![Tests](https://img.shields.io/badge/tests-60%20passing-2ea44f?style=flat-square)](agent/tests)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[What it does](#what-it-does) · [Why you can trust the numbers](#why-you-can-trust-the-numbers) · [Try it](#try-it) · [Team](#team)

</div>

## What it does

<img src="docs/images/agents-overview.png" alt="Two agents, one job each. Data Buddy: you ask about suppliers in the dataset; Nemotron reads the question, code picks the suppliers and one of 19 charts and computes the numbers; you get a comparison card. Research Buddy: you ask about a real company; it plans 4 research lanes, searches the web via Tavily, digs into red flags and writes the report; you get a risk report with every claim linked to its source." width="100%">

### 1. Data Buddy: questions about the supplier dataset

Ask in plain words. Data Buddy picks the right metric and one of 19 chart types, and drops a comparison card on the dashboard.

| You ask | You get |
|---|---|
| *"top 10 safest by total risk"* | A ranked card of the 10 safest suppliers, out of all 10,000 |
| *"Which of SUPP_00012, SUPP_00450, SUPP_00731 and SUPP_00141 has the best credit rating?"* | A scatter chart, plus *"Best: SUPP_00141 (43); worst: SUPP_00731 (76)."* |
| *"do a full analysis of the top three of this list"* | A 7-panel analysis of the first three suppliers on the card you're looking at |
| *"Compare the financial risk of SUPP_00012 and SUPP_00450"* | A question back: *Financial health or Credit rating?* It asks instead of guessing |

<img src="docs/images/dashboard.jpg" alt="Supplier workspace: comparison cards on the dashboard, Data Buddy chat on the right" width="100%">

### 2. Research Buddy: questions about a real company

Ask *"Research Knorr-Bremse for supplier risk"*. Research Buddy plans its research, searches news and public sources, digs deeper on red flags, and writes a report where every claim links to its source (here: 18 sources, 2 open red flags).

<img src="docs/images/research-report.jpg" alt="Research Buddy risk report for Knorr-Bremse: 18 sources, findings with source links, 2 open red flags" width="100%">

### 3. Supplier workspace: look for yourself, no AI

Filter and sort the whole list, open any supplier's risk profile, and collect candidates in a comparison pool. No AI involved.

<img src="docs/images/supplier-profile.jpg" alt="Supplier profile with KPIs, strongest and weakest signal, and a bar for each risk score" width="100%">

<details>
<summary><b>More screenshots</b>: a widget opened full-size, and the card types</summary>

<br>

Every answer is a widget: a preview on the dashboard that opens full-size.

<img src="docs/images/widget-open.jpg" alt="The 7-panel full supplier analysis opened full-size, starting with the overall benchmark heatmap" width="100%">

The card types, built from real data. All 12 examples are at `/cards` when the app is running.

<img src="docs/images/card-previews.jpg" alt="Six card types: ranked lollipop, log-scale spend, financial scatter, performance scatter, benchmark heatmap, replaceability grid" width="100%">
</details>

## Why you can trust the numbers

**The model understands; code decides.** Data Buddy uses Nemotron for exactly one step: reading the buyer's question. Everything after that is plain, tested Python, so **the model writes none of the numbers** you see.

```
"Which of these has the best credit rating?"
  ① Nemotron extracts   suppliers · topics ("credit rating") · intent          ← the only LLM step
  ② code checks          IDs must appear in the chat or on a card (never invented);
                         a vague phrase ("financial risk") → ask the buyer
  ③ code selects         named IDs · "this list" · "top 10 by total risk"
  ④ code routes          topic → one of 19 card templates (spec default per metric)
  ⑤ code checks the data skewed spend → log scale · near-identical values → a table, with a note
  ⑥ code computes        best, worst, quadrants, hidden risks → summary sentence
  ⑦ card → dashboard     the model only relays the summary
```

How we checked it:

| Check | Result |
|---|---|
| Unit tests: routing for all 25 metrics, ambiguity, follow-ups, facts vs the CSV | **60 / 60** pass, no API key needed (`cd agent && uv run pytest -q`) |
| Quick eval: 12 real questions through Nemotron | **12 / 12** right "ask or not", **12 / 12** exact metric, **0** invented supplier IDs |
| Multi-turn chat: two 8-turn threads, as the browser sends them | **16 / 16** turns correct at reasoning `low` |

**Honest part:** these evals are small, one run each, and the model's wording varies between runs. With reasoning set to `none`, the same threads broke down from about the fourth turn: the model started *inventing* error messages like `[ERROR: Max turns (10) exceeded]`. That's why Data Buddy runs at `low`.

### How the pieces fit

<img src="docs/images/architecture-overview.png" alt="Architecture: one chat and one dashboard in the browser, a backend that routes to Data Buddy (Python, Google ADK) or Research Buddy (TypeScript, LangGraph), and NVIDIA Nemotron models on Nebius Token Factory" width="100%">

The chat and dashboard are Next.js 16 with CopilotKit (AG-UI); every answer renders as a widget through `useRenderTool`. The detailed diagram, with ports and protocols, is [`docs/architecture.png`](docs/architecture.png). The card contract is in [`docs/specs/card-contract.md`](docs/specs/card-contract.md), and the build log is in [`docs/plans/`](docs/plans/).

## Try it

Needs [uv](https://docs.astral.sh/uv/), Node.js 22+, a [Nebius Token Factory](https://tokenfactory.nebius.com) API key and a [Tavily](https://tavily.com) API key.

```bash
git clone https://github.com/lucazagaia/vibeLabs.git && cd vibeLabs
(cd agent && uv sync && npm ci && cp .env.example .env)   # then add NEBIUS_API_KEY and TAVILY_API_KEY to agent/.env
(cd web && npm ci && cp .env.local.example .env.local)
```

Run the three servers, each in its own terminal:

```bash
cd agent && uv run uvicorn main:app --port 8000   # Data Buddy (Google ADK)
```

```bash
cd agent && npm run dev                           # Research Buddy (LangGraph) on :8123
```

```bash
cd web && npm run dev                             # web app on :3000
```

Open http://localhost:3000 and click **Start now**. No API key handy? http://localhost:3000/cards shows every chart type from real data, no agent needed.

## Limitations

- **Data Buddy has one skill: comparison cards.** It compares and ranks 2–20 suppliers well, but single-supplier questions ("Why is SUPP_00018's risk so high?") and filtering by chat aren't supported; the workspace's profile page and filters cover those. In hindsight we'd give the agent one skill per buyer use case: explain, filter, compare, shortlist memo.
- **No persistence and no login.** Cards and chat threads live in the browser and reset on reload.
- **The supplier pages load all 10,000 rows at once** (`/api/suppliers`, ~16 MB): fine locally, slow over a slow connection.
- **Research Buddy** is only as good as the public sources it finds, and needs a Tavily key.

## Developer notes

<details>
<summary><b>Configuration</b></summary>

- **`agent/.env`:**
  - `NEBIUS_API_KEY`, `TAVILY_API_KEY`
  - `NEBIUS_API_BASE`, default `https://api.tokenfactory.nebius.com/v1`
  - Data Buddy: `DATA_BUDDY_MODEL` (default `nebius/nvidia/Nemotron-3_5-Lightning`), `DATA_BUDDY_REASONING=low`
  - Research Buddy (LangGraph): `NEBIUS_ORCHESTRATOR_MODEL`, `NEBIUS_WORKER_MODEL`
- **`web/.env.local`:** `AGENT_BASE_URL` (server-only), `LANGGRAPH_DEPLOYMENT_URL`, `COPILOTKIT_TELEMETRY_DISABLED=true`
- **`deep_research/.env`:** see [`deep_research/.env.example`](deep_research/.env.example)

Restart the server after changing an env file.
</details>

<details>
<summary><b>Troubleshooting</b> (all things we actually ran into)</summary>

| Symptom | Cause | Fix |
|---|---|---|
| Research Buddy: `Unable to connect to LangGraph server` | The LangGraph server isn't running | `cd agent && npm ci && npm run dev` |
| `NEBIUS_API_KEY missing` | No `agent/.env` | `cp agent/.env.example agent/.env` and add your key |
| Every tool call fails with `No module named 'mcp'` | LiteLLM needs `mcp` for tool calls but doesn't declare it | It's already a dependency, so run `uv sync` |
| The model ignores browser tools like `show_notice` | The agent lacks `AGUIToolset()` | Every agent that should see frontend tools needs `AGUIToolset()` in its `tools` |
| The send button stays grey and the chat never connects | Next 16 *Cache Components*: CopilotKit generates IDs while rendering | Keep `<Providers>` wrapped in `<Suspense>` in `web/app/layout.tsx` |
| Calls go to `api.studio.nebius.ai` | LiteLLM's legacy default base URL for `nebius/` | `NEBIUS_API_BASE` is set explicitly in `buddy/models.py` |
| `address already in use` on :8000, :8123 or :3000 | An old server is still running | `lsof -ti tcp:8000 \| xargs kill` (same for the other ports) |
| `reasoning_effort` seems to do nothing | LiteLLM drops it for Nebius | It's sent through `extra_body` in `buddy/models.py` |
</details>

<details>
<summary><b>Repo layout</b></summary>

```
agent/                    Python ADK (port 8000) + TypeScript LangGraph (port 8123)
  main.py                 /data, /health (ADK)
  buddy/cards/            the card engine: select · route · preflight · facts · summary · composite
  buddy/skills/           the supplier-comparison-cards ADK skill (SKILL.md)
  src/                    LangGraph deep research nodes
  tests/                  60 engine tests
deep_research/            Python one-shot CLI for the same research pipeline
web/                      Next.js 16 + CopilotKit v2
  app/dashboard/          the Buddies: workspace + chat
  components/cards/       rank · scatter · table · composite renderers
data/                     Siemens.csv (10,000 anonymized suppliers) + risk_criteria_description.md
docs/                     architecture, plans, specs, screenshots
```
</details>

<details>
<summary><b>Deep research as a Python CLI</b></summary>

The same research pipeline, one-shot, in [`deep_research/`](deep_research/):

```bash
cd deep_research
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # NEBIUS_API_KEY + TAVILY_API_KEY
python app.py "Research Siemens Mobility for ESG and compliance risk"
```
</details>

## Team

**vibeLabs**, at the Nebius Build Week Hackathon with NVIDIA, Berlin, 18 October 2026:

<img src="docs/images/team.jpg" alt="Team vibeLabs in front of the Nebius and NVIDIA hackathon banner in Berlin" width="420">

Built by **Alex Gaballa, Adham Gouda and Luca Zagaia**.

Thanks to Siemens for the challenge and dataset, and to Nebius and NVIDIA for Token Factory and Nemotron.

## License

[MIT](LICENSE). The supplier dataset in [`data/`](data/) is anonymized challenge data provided by Siemens for the hackathon and is not covered by this licence.
