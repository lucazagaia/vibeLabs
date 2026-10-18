"use client";

import { useRenderTool } from "@copilotkit/react-core/v2";
import { useEffect } from "react";
import { z } from "zod";

import type { Card, ToolResult } from "./cards/types";
import { useDashboard } from "./DashboardContext";
import { widgetPath } from "./useHashPath";

// The browser half of the backend tool `compare_suppliers` (plan 05c). The tool runs in Python; its
// result arrives as a string. The chat shows a small chip, and the card itself goes on the dashboard.
export function CompareSuppliersTool() {
  const { addCard } = useDashboard();

  useRenderTool(
    {
      name: "compare_suppliers",
      agentId: "data_buddy",
      parameters: z.object({ request: z.string() }).passthrough(),
      render: ({ status, result, toolCallId }) => {
        if (status !== "complete") return <Chip>Building comparison card…</Chip>;
        const parsed = parseResult(result);
        if (parsed?.status !== "ok" || !parsed.card) return null; // a question or an error: the agent's text says it
        return <PlacedChip card={parsed.card} toolCallId={toolCallId} addCard={addCard} />;
      },
    },
    [addCard],
  );

  return null;
}

function PlacedChip({ card, toolCallId, addCard }: { card: Card; toolCallId: string; addCard: (card: Card, id: string) => void }) {
  useEffect(() => addCard(card, toolCallId), [addCard, card, toolCallId]); // idempotent per tool call

  const show = () => {
    window.location.hash = widgetPath(toolCallId).map(encodeURIComponent).join("/"); // maximize it on the dashboard
  };

  return (
    <Chip onClick={show}>
      ▦ {card.title} · {card.renderer === "composite" ? `${card.panels?.length ?? 0} panels · ` : ""}{card.suppliers.length} suppliers ·{" "}
      <span className="underline underline-offset-2">open</span>
    </Chip>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="my-1 inline-flex max-w-full items-center gap-1 truncate rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs text-black/70 enabled:hover:bg-black/[0.06] dark:border-white/15 dark:bg-white/[0.05] dark:text-white/75"
    >
      {children}
    </button>
  );
}

function parseResult(result: string | undefined): ToolResult | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result) as ToolResult;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null; // not JSON (e.g. a backend failure message): draw nothing
  }
}
