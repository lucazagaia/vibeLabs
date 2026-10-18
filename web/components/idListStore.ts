"use client";

import { useCallback, useSyncExternalStore } from "react";

// A list of supplier IDs persisted in localStorage (favourites, comparison pool). Kept in a tiny
// external store so every page reads the same list, and so the server render starts from an empty
// list without a hydration mismatch.
const EMPTY: string[] = [];

export type IdListStore = {
  useList: () => string[];
  useActions: () => { toggle: (id: string) => void; add: (id: string) => void; remove: (id: string) => void; clear: () => void };
};

export function createIdListStore(storageKey: string): IdListStore {
  let cache: string[] | null = null;
  const listeners = new Set<() => void>();

  function read(): string[] {
    if (cache) return cache;
    try {
      const saved = window.localStorage.getItem(storageKey);
      const parsed = saved ? (JSON.parse(saved) as unknown) : null;
      cache = Array.isArray(parsed) ? (parsed as string[]) : EMPTY;
    } catch {
      cache = EMPTY;
    }
    return cache;
  }

  function write(next: string[]) {
    cache = next;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore unwritable storage
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      cache = null;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return {
    useList: () => useSyncExternalStore(subscribe, read, () => EMPTY),
    useActions: () => ({
      toggle: useCallback((id: string) => {
        const current = read();
        write(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
      }, []),
      add: useCallback((id: string) => {
        const current = read();
        if (!current.includes(id)) write([...current, id]);
      }, []),
      remove: useCallback((id: string) => write(read().filter((item) => item !== id)), []),
      clear: useCallback(() => write([]), []),
    }),
  };
}
