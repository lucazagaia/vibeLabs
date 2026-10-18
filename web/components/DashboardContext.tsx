"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type Notice = {
  id: number;
  text: string;
  agentId: string | null;
  createdAt: Date;
};

type DashboardContextValue = {
  notices: Notice[];
  addNotice: (text: string, agentId: string | null) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

// Dashboard state lives in the browser for now; the persisted UI-state store comes later.
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const addNotice = useCallback((text: string, agentId: string | null) => {
    setNotices((prev) => [{ id: prev.length + 1, text, agentId, createdAt: new Date() }, ...prev]);
  }, []);

  const value = useMemo(() => ({ notices, addNotice }), [notices, addNotice]);
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return value;
}
