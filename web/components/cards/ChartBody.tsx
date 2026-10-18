"use client";

import { RankCard } from "./RankCard";
import { ScatterCard } from "./ScatterCard";
import { TableCard } from "./TableCard";
import type { Card } from "./types";

const BODY = { rank: RankCard, scatter: ScatterCard, table: TableCard } as const;

/** The chart of a single (non-composite) card, full size or as a small preview. */
export function ChartBody({ card, preview = false }: { card: Card; preview?: boolean }) {
  if (card.renderer === "composite") return null;
  const Body = BODY[card.renderer];
  return <Body card={card} preview={preview} />;
}
