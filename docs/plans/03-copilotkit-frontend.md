# Step 3: CopilotKit frontend: chat + Data/Research switch + dashboard skeleton

Part of [00-basics-architecture.md](00-basics-architecture.md). It consumes **C2** (the agent endpoints from Step 2), and implements **C3** (the runtime route + switch) and the frontend half of **C4** (`show_notice`).

## Context
The backend serves `data_buddy` at `/data` and `research_buddy` at `/research` over AG-UI (Step 2, all smoke checks green). This step builds the **first real UI** on top:
- a Next.js app with the CopilotKit chat on the left
- a deterministic **Data ⇄ Research switch** above it
- an empty "dashboard" area on the right, where the `show_notice` frontend tool renders cards

These decisions are locked from Checkpoint 2:
- **Separate threads per agent.** Flipping the switch shows that agent's own conversation. The agents don't share history (option 3).
- **In-memory sessions** for now. A page reload starts fresh conversations, and persistence comes with the UI-state store later.
- **Research Buddy stays on Super.**

**In scope:**
- `web/` scaffold
- the CopilotKit runtime route
- the provider
- the two-pane layout
- the switch
- `show_notice`
- the Inspector

**Out of scope:**
- real dashboard panels (W1–W12)
- the UI-state store
- `/api/data/*`
- styling polish

## What we verified in the docs and package metadata

| # | Finding | Source | Consequence |
|---|---|---|---|
| F1 | The runtime route pattern: `CopilotRuntime({ agents: { id: new HttpAgent({ url }) }, runner: new InMemoryAgentRunner() })` and `createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" })`, exported as `GET` and `POST` from `app/api/copilotkit/[[...slug]]/route.ts`. | CopilotKit docs (FastAPI / AG-UI agent setup) | We register **both** agents in one runtime (C3). |
| F2 | `CopilotChat` (from `@copilotkit/react-core/v2`) takes **`agentId`** and **`threadId`** props. On mount it binds that agent's messages and running state. | Reference: `components/CopilotChat` | Two chat instances, one per agent, each with its own `threadId`, give the separate threads. |
| F3 | `useFrontendTool({ name, description, parameters: z.object(...), handler, render? })` from `@copilotkit/react-core/v2` uses **Zod** schemas in v2. The handler runs in the browser, and its return value goes back to the agent as the tool result. Tools registered this way are forwarded to every agent over AG-UI. | Reference: `hooks/useFrontendTool` | `show_notice` adds a card to dashboard state and returns `"Notice shown"`. It's available to both agents, since both declare `AGUIToolset()`. |
| F4 | Reasoning (`REASONING_MESSAGE_*`) renders **by default** as a collapsible card: "Thinking…" while it runs, then "Thought for X seconds". It can be customised or replaced through the `messageView.reasoningMessage` slot. | Docs: "Reasoning Messages" | Nemotron's reasoning shows up neatly with no extra work. Whether to hide it is a Checkpoint 3 decision. |
| F5 | `<CopilotKit runtimeUrl=… enableInspector>` turns on the **Inspector**, which shows AG-UI events. `CopilotChat` also has `inspectorTools` (default true). | Reference: `components/CopilotKit` | We use the Inspector to verify events per agent. |
| F6 | `@copilotkit/react-core` and `@copilotkit/runtime` **1.79.1** pin **`@ag-ui/client` to exactly 1.0.2**. The runtime depends on **`zod ^3.25`**, and react-core's peer dependency is `zod >=3.25`. | `npm view … dependencies` | We install `@ag-ui/client@1.0.2` (not 1.0.3), so there aren't two `HttpAgent` copies, and **zod 3** (not 4). |
| F7 | The ADK backend ends every run with a `STATE_SNAPSHOT` (Step 2, B7). | Step 2 smoke output | We don't use `agent.state` for app data in this step, and the dashboard keeps its own React state. That's harmless for now, and it gets handled properly with the UI-state store. |

## Files

```
vibeLabs/
├─ .claude/launch.json                     # dev servers for the browser pane: "agent" (:8000), "web" (:3000)
└─ web/                                    # create-next-app 16.4.x: TypeScript, App Router, Tailwind, ESLint, npm
   ├─ .env.local.example                   # AGENT_BASE_URL=http://localhost:8000   (server-only, no NEXT_PUBLIC_)
   ├─ app/
   │  ├─ api/copilotkit/[[...slug]]/route.ts   # C3: runtime with data_buddy + research_buddy
   │  ├─ providers.tsx                     # "use client": <CopilotKit runtimeUrl="/api/copilotkit" enableInspector>
   │  ├─ layout.tsx                        # imports @copilotkit/react-core/v2/styles.css, wraps in <Providers>
   │  └─ page.tsx                          # two-pane layout
   └─ components/
      ├─ AgentSwitch.tsx                   # Data ⇄ Research segmented button
      ├─ ChatPane.tsx                      # two CopilotChat instances; only the active one is visible
      ├─ Dashboard.tsx                     # right pane: empty state + notice cards
      └─ ShowNoticeTool.tsx                # useFrontendTool("show_notice") -> adds a notice card
```

## Code outlines

**`app/api/copilotkit/[[...slug]]/route.ts` (C3)**
```ts
import { CopilotRuntime, createCopilotRuntimeHandler, InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { HttpAgent } from "@ag-ui/client";

const base = process.env.AGENT_BASE_URL ?? "http://localhost:8000";

const runtime = new CopilotRuntime({
  agents: {
    data_buddy: new HttpAgent({ url: `${base}/data` }),
    research_buddy: new HttpAgent({ url: `${base}/research` }),
  },
  runner: new InMemoryAgentRunner(),
});

const handler = createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit" });
export const GET = handler;
export const POST = handler;
```

**`components/ChatPane.tsx`: the switch and separate threads**
```tsx
"use client";
// Both chats stay mounted; the inactive one is hidden. Each keeps its own threadId, messages and scroll position,
// so flipping the switch never loses a conversation and never mixes histories.
const AGENTS = [
  { id: "data_buddy", label: "Data Buddy" },
  { id: "research_buddy", label: "Research Buddy" },
] as const;

export function ChatPane() {
  const [active, setActive] = useState<(typeof AGENTS)[number]["id"]>("data_buddy");
  const threadIds = useMemo(() => ({ data_buddy: crypto.randomUUID(), research_buddy: crypto.randomUUID() }), []);
  return (
    <div className="flex h-full flex-col">
      <AgentSwitch agents={AGENTS} active={active} onChange={setActive} />
      {AGENTS.map((a) => (
        <div key={a.id} className={a.id === active ? "min-h-0 flex-1" : "hidden"}>
          <CopilotChat agentId={a.id} threadId={threadIds[a.id]} labels={{ /* placeholder per agent */ }} />
        </div>
      ))}
    </div>
  );
}
```

**`components/ShowNoticeTool.tsx` (C4)**
```tsx
"use client";
useFrontendTool({
  name: "show_notice",                        // must match C4 exactly
  description: "Show a short notice card on the dashboard.",
  parameters: z.object({ text: z.string().describe("The notice text") }),
  handler: async ({ text }) => { addNotice(text); return "Notice shown"; },
}, [addNotice]);
```
The notices live in a small React context (`DashboardProvider`). `Dashboard.tsx` renders them as cards, newest first, with the empty state "Ask a Buddy something…" until the first card appears.

**`page.tsx`:** a full-height two-column grid. The left column (about 420px) holds `ChatPane`; the right column holds `Dashboard`. On narrow screens they stack.

**`.claude/launch.json`:**
- `"agent"` runs `uv run uvicorn main:app --port 8000`, with `agent/` as its working directory.
- `"web"` runs `npm run dev` on port 3000, with `web/` as its working directory.

This lets the app's browser pane start and preview the frontend.

## Execution order, with a pause

**3a: scaffold + one working chat**
1. Branch `feat/copilotkit-frontend`, cut from `feat/adk-backend`.
2. `npx create-next-app@16.4.2 web --ts --app --tailwind --eslint --use-npm --no-src-dir --import-alias "@/*" --yes`
3. `cd web && npm i @copilotkit/react-core@1.79.1 @copilotkit/runtime@1.79.1 @ag-ui/client@1.0.2 zod@^3.25` (F6)
4. Write `route.ts`, `providers.tsx`, `layout.tsx`, and a temporary `page.tsx` with a single `CopilotChat agentId="data_buddy"`. Add `.env.local.example`, copy it to `.env.local` (no secrets in it), and add `.claude/launch.json`.
5. Start the agent (:8000) and the web app (:3000). In the browser pane, ask "How many suppliers are in the dataset?" and expect a streamed answer with 10,000 and a reasoning card. Check the events in the Inspector.

**⏸ Pause 3a→3b:** a screenshot of the working chat, plus anything surprising. Then your go.

**3b: switch + dashboard + frontend tool**
6. Add `AgentSwitch`, `ChatPane` (two threads), `Dashboard` and `ShowNoticeTool`, and build the final `page.tsx`.
7. Browser checks:
   - Data: "Show a notice saying hello" makes a card appear on the right.
   - Switch to Research: "Hi" gets Research Buddy's reply in an empty, separate thread.
   - Switch back: the Data thread is intact.
   - Research: "Show a notice saying research works" also makes a card appear.
8. `npm run build` passes, with no type errors. Stop both servers, then commit locally. No push.

**⏸ Checkpoint 3:** screenshots (chat, switch, notice card, Inspector) and the decisions below. Step 4 (integration + README) only after your go.

## Decisions to settle at Checkpoint 3
1. **Reasoning card:** keep CopilotKit's default collapsible "Thought for X seconds" card, or hide reasoning entirely? I recommend keeping it, since it looks good in a demo.
2. **Look:** keep the default CopilotKit styling for now, or apply a first pass of the dark/minimal style from the Stitch concept?
3. **Tool-call display in the chat:** should `show_notice` also render a small inline chip in the chat ("📌 Notice added"), or only the dashboard card?

## Pitfalls we already know about
- **v1 vs v2 APIs:** import only from `@copilotkit/react-core/v2` and `@copilotkit/runtime/v2`. The docs mix both versions.
- **Version skew (F6):** a second `@ag-ui/client` version can cause `HttpAgent` type errors or silent protocol mismatches. Check with `npm ls @ag-ui/client`.
- **Client vs server components:** `providers.tsx`, `ChatPane` and the tool component need `"use client"`. `layout.tsx` stays a server component.
- **`AGENT_BASE_URL` is server-only.** The browser talks only to `/api/copilotkit`, and the runtime calls the agent server to server, so no CORS is needed.
- **Tool name casing:** `show_notice` must match C4 exactly, or the backend model gets a tool it can't map.
- **Hidden chats still run.** A reply finishing in the hidden chat is fine, because its messages stay in that agent's thread.
- **Leftover servers:** stop both dev servers after the checks.

## Done when
- [ ] Chatting with Data Buddy streams answers, and the dataset question gives 10,000 via `dataset_info`.
- [ ] The switch flips to Research Buddy with a separate thread, and switching back keeps both histories.
- [ ] `show_notice` from either agent adds a card to the dashboard.
- [ ] The Inspector shows the AG-UI events for both agents.
- [ ] `npm run build` passes, `npm ls @ag-ui/client` shows a single 1.0.2, and no secrets are committed.
