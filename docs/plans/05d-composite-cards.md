# Step 5d: Composite cards, conversational follow-ups, preview widgets

Follows [05c](05c-card-integration.md). Triggered by a live conversation that was too strict: "top three of this
list" re-ranked instead of using the list, "compare on all metrics" asked a 23-option question, typed IDs were
ignored, and the model claimed only one metric per card was possible.

## Engine (agent/buddy/cards)
| Change | Where |
|---|---|
| **Composite cards:** several named topics → one card, `renderer: "composite"`, `panels: Card[]`, one panel per topic with its spec chart. A spec pair (financial health + credit rating) or 3+ metrics of one cluster stay one panel. 2–6 panels; one panel = an ordinary card | `composite.py` (`panel_groups`, `build_composite`) |
| **"All metrics" / "full analysis" / "everything":** overview heatmap + 6 family panels, never a question | `validate.ALL_METRICS`, `composite.build_all_metrics` |
| **"All of them"** answers "which one?": every candidate, side by side (the question now offers it) | `validate.ALL_OF_THEM` |
| **Supplier IDs from the thread, never invented:** request → buyer's latest message → "these / this list / top three of them" (last card, in its order) → model IDs only if the buyer wrote them or they were on a card → tray / ranking → the card on screen → ask | `tool._suppliers`, `thread.py` |
| **Model view of a result:** summary + card title + supplier IDs (+ panel titles), not the card data | `tool.model_view` |
| `build_card` moved to `build.py` (re-exported from `tool.py`) | |

## Frontend (web/components)
- **Dashboard = grid of previews** (title, 2-line summary, mini chart; composites show up to 4 mini panels). Click → **maximized** over the right side with a path: `Widgets / <card>`; a composite's "Expand ↗" goes to `Widgets / <card> / <panel>`.
- The path lives in the URL hash (`#widgets/<toolCallId>/<panel>`), so the back button works. The chat chip opens the maximized card.
- `CompositeCard`, `ChartBody`, preview mode in `RankCard` / `ScatterCard` / `TableCard`, `useHashPath`.
- `/cards` gallery: previews + full cards, with 2 new composite fixtures (11, 12).

## Verified
- 60 unit tests, including a replay of the failing conversation through a fake thread.
- Live (one thread, CopilotKit-style resends): top 10 → top three of this list (7-panel full analysis of those three) → all metrics → 3-topic composite → reputation question → "All of them". All six turns correct.
- Not checked visually in the browser this round (skipped for time).
