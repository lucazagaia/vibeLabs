# Step 4: Integration milestone: README + end-to-end checklist

Part of [00-basics-architecture.md](00-basics-architecture.md). This closes the walking skeleton.

## Context
Steps 1–3 each passed their own checks. This step proves the **whole skeleton works for someone who only has the repo and the README**. That's the hand-off point for Alex and Adham, and the base for the Data Buddy work (P0 in the concept plan).

These decisions are applied from Checkpoint 3:
- **Data Buddy reasoning is `none`.** It's faster, there are fewer "Thought…" cards, and tool routing still works (Step 1, T7). Research Buddy stays on `medium`.
- **Default CopilotKit styling.** A design pass comes later.
- **No inline tool chip in the chat.** The dashboard card is the feedback.

## Deliverables
1. **`README.md` (repo root)**, the only document a teammate needs. It covers:
   - what the app is
   - an architecture sketch
   - prerequisites
   - one-time setup for `agent/` and `web/`
   - how to run both services
   - smoke tests
   - things to try in the UI
   - the repo layout
   - links to the plans
   - troubleshooting for every pitfall we hit in Steps 1–3
2. **End-to-end checklist, run on a fresh clone,** following only the README.

## End-to-end checklist (fresh clone, README only)

| # | Check | How | Pass condition |
|---|---|---|---|
| E0 | Setup from scratch | `git clone`, then follow README setup: `uv sync`, `npm ci`, copy the `.env` templates, add the key | No errors, and no step missing from the README |
| E1 | Model layer | `uv run python scripts/smoke_models.py` | All checks pass |
| E2 | Agent endpoints | Start the agent, then `uv run python scripts/agui_smoke.py` | S1–S4 pass |
| E3 | Data Buddy in the UI | Start the web app, then ask Data Buddy "How many suppliers are in the dataset?" | It answers 10,000 (via `dataset_info`), with fewer reasoning cards than before |
| E4 | Switch | Flip to Research Buddy and say "Hi" | Separate, empty thread, and a Research Buddy reply |
| E5 | Frontend tool | Ask either agent to "Show a notice saying hello" | A card appears on the dashboard |
| E6 | Model provenance | Agent server log | Requests go to `nebius/nvidia/…` at the Token Factory base URL |

## Out of scope
- pushing or opening a PR (that's decided at Checkpoint 4)
- deployment
- any Data Buddy features

## ⏸ Checkpoint 4 (final for the basics)
- Results of E0–E6, plus any README fixes the fresh run forced.
- **Questions to settle:**
  - push the branches and open a PR to `main`?
  - what to tackle first in the Data Buddy work?
