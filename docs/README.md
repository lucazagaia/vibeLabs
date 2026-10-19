# Docs

How Supplier Risk Buddy was designed and built, step by step. Start with the architecture, then read the plans in order.

| | |
|---|---|
| [`architecture.png`](architecture.png) · [`.svg`](architecture.svg) | The multi-agent architecture |
| [`specs/card-contract.md`](specs/card-contract.md) | The card contract shared by the Python engine and the React renderers |
| [`specs/comparison-card-template-spec.md`](specs/comparison-card-template-spec.md) | Which chart fits which metric (the template spec the engine routes by) |
| [`plans/buddy-capability-plan.md`](plans/buddy-capability-plan.md) | The original concept: use cases, tools, panels |
| [`plans/00-basics-architecture.md`](plans/00-basics-architecture.md) | Step 0: the basic architecture and contracts |
| [`plans/01-model-layer.md`](plans/01-model-layer.md) | Step 1: Nemotron on Nebius Token Factory through LiteLLM |
| [`plans/02-adk-backend.md`](plans/02-adk-backend.md) | Step 2: two Google ADK agents served over AG-UI |
| [`plans/03-copilotkit-frontend.md`](plans/03-copilotkit-frontend.md) | Step 3: the CopilotKit chat and dashboard |
| [`plans/04-integration.md`](plans/04-integration.md) | Step 4: end-to-end integration |
| [`plans/05-comparison-card-skill.md`](plans/05-comparison-card-skill.md) | Step 5: comparison cards as an ADK skill ("the agent extracts, code decides") |
| [`plans/05c-card-integration.md`](plans/05c-card-integration.md) | Step 5c: cards on the dashboard, and what broke in the browser |
| [`plans/05d-composite-cards.md`](plans/05d-composite-cards.md) | Step 5d: multi-panel cards, follow-ups, preview widgets |
| [`images/`](images/) | Screenshots used in the main README |

The column descriptions for the dataset are in [`../data/risk_criteria_description.md`](../data/risk_criteria_description.md).
