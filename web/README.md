# web: vibeLabs frontend

Next.js 16 + CopilotKit v2: a landing page at `/` (world map of ships on radar, `components/ui/world-radar-map.tsx`), and at `/dashboard` the chat with the Data ⇄ Research switch and the dashboard.

Setup, running and troubleshooting are in the [root README](../README.md).

```bash
npm ci
cp .env.local.example .env.local
npm run dev        # http://localhost:3000 (needs the agent server on :8000)
```

Note: `AGENTS.md` here is generated and maintained by `next dev`; keep it committed.
