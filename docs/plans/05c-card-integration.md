# Step 5c: Comparison cards on the dashboard (renderers + `useRenderTool` + Nemotron retry)

Part of [05-comparison-card-skill.md](05-comparison-card-skill.md). It consumes the frozen card contract ([card-contract.md](../specs/card-contract.md)), the 10 engine-built fixtures, and the `compare_suppliers` tool from 5b.

## Context
5b is on `main`. Data Buddy loads the skill, calls `compare_suppliers` once, and gets a validated `Card` back. All five live prompts gave the right card, but nothing is drawn yet. The browser only has `show_notice`.

This step makes the card visible:
- three renderers (`rank`, `scatter`, `table`) inside one `CardShell`
- `useRenderTool("compare_suppliers")`, which takes the tool result and puts the card on the dashboard
- one retry when Nemotron writes a tool call as plain text instead of calling it (seen 1 in 4 runs at Checkpoint 5b, when no card appeared)

These decisions are locked from earlier steps:
- **The browser owns UI state.** Cards live in React state for now, and the UI-state store comes later.
- **Separate threads per agent.** Both chats stay mounted, so a tool renderer keeps working while the other agent is shown.
- **The agent extracts, code decides.** The renderers draw what the card says. They don't re-sort, re-band or recompute facts.

**In scope:**
- the retry wrapper in `buddy/models.py`
- `web/components/cards/*`
- a `/cards` fixture gallery
- dashboard placement
- the quick eval and a browser check

**Out of scope:**
- the parallel-coordinates and radar cards (still deferred)
- the UI-state store and reload persistence
- trimming what the model sees in the tool result (see "Later")
- Research Buddy

## What we verified in the installed packages

| # | Finding | Source | Consequence |
|---|---|---|---|
| F1 | `useRenderTool({ name, parameters, render, agentId? }, deps)` exists in `@copilotkit/react-core/v2` 1.79.1. `render` gets `{ name, toolCallId, parameters, status, result }`. `status` is `inProgress`, `executing` or `complete`, and `result` is a **string**, set only when `complete`. | `dist/copilotkit-*.d.mts` | We `JSON.parse(result)` to get `ToolResult`. A backend tool needs no handler, just the renderer. |
| F2 | The renderer's output appears **inside the chat**, next to the tool call. It doesn't go to the dashboard. | Same file: `useRenderToolCall`, `CopilotChatToolCallsView` | **Bridge:** the chat shows a small chip, and a `useEffect` in that chip calls `addCard(card, toolCallId)` on the dashboard context. |
| F3 | `render` runs again on every re-render and when a thread is replayed. | Hook contract (render function, no lifecycle) | `addCard` is **idempotent by `toolCallId`**, so a card is never added twice. |
| F4 | ag-ui-adk runs ADK with `StreamingMode.SSE` (`adk_agent.py:1297`). LiteLlm yields **partial** text chunks as they arrive, then one final aggregated response. | ag-ui-adk + `google/adk/models/lite_llm.py` | A raw `<tool_call>` streams into the chat as it arrives, so the retry must **hold text back** until it knows the output isn't raw markup. It can't retract text afterwards. |
| F5 | In the failed run, Nemotron's text **started** with `<tool_call>`, and its closing tags were malformed (`</name>` instead of `</parameter>`). | Checkpoint 5b live run | We detect it from the opening characters and retry. We don't parse the markup, since it isn't reliably well-formed. |
| F6 | Fixtures are 3–24 KB. The largest is the overview: 10 suppliers × 22 metrics. | `web/components/cards/fixtures/` | Plain SVG and HTML tables handle this easily. No virtualisation is needed. |

## Files

```
agent/
├─ buddy/models.py                    # + NemotronLlm(LiteLlm): hold-back + one retry on raw tool-call text
└─ tests/test_models.py               # fake streams: raw→good, normal text untouched, raw twice → apology
web/
├─ app/cards/page.tsx                 # fixture gallery: all 10 fixtures, for building and the browser check
├─ app/page.tsx                       # + <CompareSuppliersTool />
└─ components/
   ├─ DashboardContext.tsx            # + cards: PlacedCard[], addCard(card, toolCallId), removeCard(id)
   ├─ Dashboard.tsx                   # cards (newest first) above notices
   ├─ CompareSuppliersTool.tsx        # useRenderTool("compare_suppliers", agentId "data_buddy") → chip + addCard
   └─ cards/
      ├─ types.ts                     # Card / ToolResult types, hand-copied from buddy/cards/schema.py
      ├─ bands.ts                     # level → colour, value → band (referenceBands), number formatting
      ├─ CardShell.tsx                # title, summary, dataShape notes, band legend, close; picks the renderer
      ├─ RankCard.tsx                 # lollipop lanes: fixed 0–100, linear or log; one lane per metric
      ├─ ScatterCard.tsx              # 2 axes, threshold lines, quadrant labels, good zone, optional dot size
      └─ TableCard.tsx                # banded cells + raw values; 3×3 grid for replaceability; row flags
```

## Code outlines

**Retry (`buddy/models.py`):**
```python
RAW_CALL = "<tool_call>"

class NemotronLlm(LiteLlm):
    """LiteLlm, plus one retry when Nemotron writes a tool call as text instead of calling it."""
    async def generate_content_async(self, llm_request, stream=False):
        for attempt in (1, 2):
            held, seen, raw = [], "", False
            async for r in super().generate_content_async(llm_request, stream):
                text = visible_text(r)                 # non-thought text parts only; reasoning passes straight through
                if not text and not held: yield r; continue
                seen += text
                if len(seen.lstrip()) < len(RAW_CALL) and r.partial: held.append(r); continue   # not sure yet
                if seen.lstrip().startswith(RAW_CALL) and not has_function_call(r): raw = True; break
                for h in held: yield h
                held = []; yield r
            if not raw: return
            log.warning("raw tool-call text from %s (attempt %d), retrying", self.model, attempt)
        yield apology_response()   # "Sorry, I couldn't finish that. Please ask again." (no markup reaches the chat)
```
`get_model` returns `NemotronLlm`, so both agents get it, and the rest of `models.py` stays the same.

**Render bridge (`CompareSuppliersTool.tsx`):**
```tsx
useRenderTool({
  name: "compare_suppliers", agentId: "data_buddy",
  parameters: z.object({ request: z.string() }).passthrough(),
  render: ({ status, result, toolCallId }) => {
    if (status !== "complete") return <Chip>Building comparison card…</Chip>;
    const r = safeParse(result);                         // ToolResult | null
    if (r?.status !== "ok" || !r.card) return null;      // a question or error: the agent's text says it
    return <PlacedChip card={r.card} toolCallId={toolCallId} />;   // useEffect → addCard (idempotent)
  },
}, [addCard]);
```
Clicking the chip scrolls the dashboard to `#card-{toolCallId}` and highlights it briefly.

**Renderers, which draw only what the card says:**
- **Shared:**
  - Order comes from the card (`suppliers` is already sorted).
  - Colours come from `levels`, or from `referenceBands` when there's no level.
  - `valueDirection` sets the axis caption ("lower is better").
  - Flags (`best`, `worst`, `outlier`, `hidden_watchout`) become badges.
- **`rank`:**
  - **Scale:** `dataShape.scale` picks it: `fixed_0_100`, `linear` (data min–max with padding) or `log` (log10 for spend).
  - **Lanes:** multi-metric cluster cards draw one lane per metric, stacked.
- **`scatter`:**
  - **Axes:** `quadrants.x` and `quadrants.y`, with threshold lines at `xThreshold` and `yThreshold`.
  - **Quadrants:** labelled in the corners; `goodZone` is tinted.
  - **Dot size:** a third metric (order change rate) sets it.
  - **Overlaps:** a deterministic jitter (a hash of `supplierID`) separates exact overlaps, and labels get alternating offsets.
- **`table`:**
  - **Cells:** colour-banded, with the raw value.
  - **Wide tables:** the 22 overview columns get a sticky first column and horizontal scroll.
  - **`replaceability_complexity_card`:** drawn as the 3×3 grid from `facts.grid`.
  - **`hidden_outlier_card`:** the hidden watch-outs are highlighted.

## Execution order, with pauses

1. **5c-1, the retry (backend, small):**
   - `NemotronLlm`
   - 3 unit tests with fake streams
   - Live check: the credit prompt 4 times. The server log counts retries, and no `<tool_call>` text reaches the chat.

   **⏸ Pause:** the result in a few lines.
2. **5c-2, renderers on fixtures:**
   - `types.ts`, `bands.ts`, `CardShell` and the three renderers
   - the `/cards` gallery
   - `npm run build` + lint
   - In the browser pane: screenshots of all 10 fixtures, light and dark (desktop only; no mobile layout). These need no agent, so a teammate can take 5c-2 against the fixtures while 5c-1 runs.

   **⏸ Pause:** with the screenshots.
3. **5c-3, integration:**
   - the `DashboardContext` cards, `CompareSuppliersTool`, and the dashboard layout
   - In the browser: the five 5b prompts plus the plan 05 bankrupt prompt, end to end
   - `skill_smoke.py --quick-eval` once
   - Commit locally.

   **⏸ Checkpoint 5.**

## Decisions to settle now (my recommendation first)
1. **Plain SVG and HTML tables, with no chart library.** Three simple shapes don't justify a dependency, and that avoids React 19.3 / Next 16 compatibility risk. *Alternative:* Recharts, which gives faster axes but makes the quadrant and band styling harder.
2. **Card on the dashboard, chip in the chat.** The chat stays readable, and the dashboard is where cards live. *Alternative:* draw the full card inline in the chat too.
3. **On a second raw tool call, show a short apology.** Hiding it silently would leave the buyer waiting with nothing.

## Pitfalls we already know about
- `render` must be pure apart from the idempotent `addCard` effect. Otherwise React StrictMode's double render in dev adds cards twice.
- `result` can be a non-JSON string if the backend fails before the tool returns. `safeParse` returns `null` and nothing is drawn.
- `load_skill` tool calls have no renderer and draw nothing in the chat, which is what we want. We don't register a `"*"` wildcard renderer.
- Holding text back adds no delay to normal replies after the first ~11 characters. Reasoning chunks are never held.
- Cards disappear on reload, and so do the threads (in-memory runner, Step 3 F8). That's expected until the UI-state store exists.

## Found in 5c-3 (browser), and fixed
The scripted runs used a fresh thread per prompt and no browser tools. The browser has both, and that showed four problems:

| # | Seen in the browser | Cause | Fix (code decides) |
|---|---|---|---|
| B1 | The same question repeated 3 times | After a clarification, the model called `show_notice` anyway; the frontend tool re-ran the agent | `hide_notice_unless_asked` (`before_model_callback`): `show_notice` reaches the model only if the buyer's message says "notice". `AGUIToolset(tool_filter=...)` can't do this: ag-ui-adk calls the filter without the run context |
| B2 | "Least likely to go bankrupt" asked a question, or ranked on total risk | The model listed both financial metrics, or none | `CLEAR_CUES` in `validate.py`: a cue word in the buyer's message ("bankrupt", "credit rating", "on time", "hacking", ...) narrows the candidates or fills in a missing metric |
| B3 | From the 4th turn of a thread: replies like "[ERROR: Max turns (10) exceeded]" | **Made up by the model**, not by any library (verified: not in any dependency, and the model call is logged). At reasoning `none`, Nemotron Lightning drifts in longer tool-calling threads, then copies its own error text on every later turn | Data Buddy reasoning is now **`low`**: 16/16 turns correct in two 8-turn threads (about 3–5 s per turn). It also stopped the stray `dataset_info` calls and the wordy replies |
| B4 | Every card (3–25 KB of JSON) stayed in the model's context | The tool result is both the frontend event and the model's history | `slim_card_results` (`before_model_callback`): the model sees only `status`/`summary`/question; the stored session and the frontend keep the full card |

## Later (not in 5c)
- Parallel-coordinates and radar renderers.
- Turn off CopilotKit's Inspector for the demo: its floating button covers the ✕ on the top dashboard card.

## Done when
- [x] 5c-1: unit tests pass; in 4 live credit prompts, no `<tool_call>` text reaches the chat. (The retry wasn't triggered live in 14 runs; unit tests only.)
- [x] 5c-2: all 10 fixtures render in `/cards` with no overlapping labels, light and dark; `npm run build` is clean. (Desktop only.)
- [x] 5c-3: each prompt puts exactly one card on the dashboard. The reply matches `summary`. "Financial risk" shows the question with no card, and answering it adds the card. A re-render or agent switch never duplicates a card, and a closed card stays closed.
- [x] The quick eval holds: 12/12 on ask-or-not, 12/12 on the exact metric, no supplier IDs invented.
