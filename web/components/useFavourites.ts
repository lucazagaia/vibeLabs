"use client";

import { useCallback, useSyncExternalStore } from "react";

// Favourited supplier IDs, persisted in localStorage. Kept in a tiny external store so the
// sidebar badge, the supplier table and the profile page all read the same list, and so the
// server render starts from an empty list without a hydration mismatch.
const STORAGE_KEY = "vibelabs-favourites";
const EMPTY: string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (cache) return cache;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore unwritable storage
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFavourites() {
  const favourites = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggleFavourite = useCallback((supplierID: string) => {
    const current = read();
    write(current.includes(supplierID) ? current.filter((item) => item !== supplierID) : [...current, supplierID]);
  }, []);

  return { favourites, toggleFavourite };
}
