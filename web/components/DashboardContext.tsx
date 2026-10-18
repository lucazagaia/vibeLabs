"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { Card } from "./cards/types";

export type Notice = {
  id: number;
  text: string;
  agentId: string | null;
  createdAt: Date;
};

// A comparison card from a `compare_suppliers` tool call. Keyed by the tool call, so re-renders and
// thread replays of the same call never add it twice.
export type PlacedCard = {
  toolCallId: string;
  card: Card;
  createdAt: Date;
};

type DashboardContextValue = {
  notices: Notice[];
  addNotice: (text: string, agentId: string | null) => void;
  cards: PlacedCard[];
  addCard: (card: Card, toolCallId: string) => void;
  removeCard: (toolCallId: string) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

// Dashboard state lives in the browser for now; the persisted UI-state store comes later.
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [cards, setCards] = useState<PlacedCard[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());

  const addNotice = useCallback((text: string, agentId: string | null) => {
    setNotices((prev) => [{ id: prev.length + 1, text, agentId, createdAt: new Date() }, ...prev]);
  }, []);

  const addCard = useCallback(
    (card: Card, toolCallId: string) => {
      if (removed.has(toolCallId)) return; // closed by the buyer: a replay must not bring it back
      setCards((prev) => (prev.some((c) => c.toolCallId === toolCallId) ? prev : [{ toolCallId, card, createdAt: new Date() }, ...prev]));
    },
    [removed],
  );

  const removeCard = useCallback((toolCallId: string) => {
    setRemoved((prev) => new Set(prev).add(toolCallId));
    setCards((prev) => prev.filter((c) => c.toolCallId !== toolCallId));
  }, []);

  const value = useMemo(
    () => ({ notices, addNotice, cards, addCard, removeCard }),
    [notices, addNotice, cards, addCard, removeCard],
  );
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return value;
}
