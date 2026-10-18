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

## Results (18 Oct, fresh clone of `feat/copilotkit-frontend`, set up from the README alone)

| # | Result |
|---|---|
| E0 | ✅ `uv sync`, `npm ci` and the two env templates worked as written. No README changes were needed. There's a single `@ag-ui/client@1.0.2`. |
| E1 | ✅ 17/18. Lightning missed the tool once in T7 at `reasoning_effort=none`. A follow-up of 40 calls showed it's noise, not a regression: **`none` called the tool 10/10** both without and with Data Buddy's instruction, and `low` was 9/10 without and 10/10 with it. `none` is also faster: median 246 ms vs 412 ms with the instruction. |
| E2 | ✅ S1–S4, 4/4. Data Buddy runs no longer contain any `REASONING_*` events. Research Buddy's still do. |
| E3 | ✅ Data Buddy answered "The dataset contains 10,000 suppliers." with **no "Thought…" cards**. |
| E4 | ✅ Research Buddy opened a separate, empty thread and replied. Its reasoning cards remain (`medium`). |
| E5 | ✅ A "Notice · Data Buddy / hello" card appeared on the dashboard. The tool result went back to the agent, and it continued. |
| E6 | ✅ LiteLLM resolves both agents to provider `nebius` at `https://api.tokenfactory.nebius.com/v1` (not the legacy Studio URL). |

**Observations:**
- **Typing right after page load:** the first Return didn't submit, because the chat was still connecting. The next message was then sent together with it. The agent handled the combined request correctly (notice, then answer), but that run took about 30–40 s. Watch latency on combined, multi-tool requests.
- **The fresh clone was deleted after the run,** since it held a copy of `agent/.env`.

## Out of scope
- pushing or opening a PR (that's decided at Checkpoint 4)
- deployment
- any Data Buddy features

## ⏸ Checkpoint 4 (final for the basics)
- Results of E0–E6, plus any README fixes the fresh run forced.
- **Questions to settle:**
  - push the branches and open a PR to `main`?
  - what to tackle first in the Data Buddy work?
