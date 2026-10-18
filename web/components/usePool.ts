"use client";

import { createIdListStore } from "./idListStore";

// Suppliers the buyer put side by side on the Comparison Pool page.
const store = createIdListStore("vibelabs-comparison-pool");

export function usePool() {
  const pool = store.useList();
  const { toggle, add, remove, clear } = store.useActions();
  return { pool, togglePooled: toggle, addToPool: add, removeFromPool: remove, clearPool: clear };
}
