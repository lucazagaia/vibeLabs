"use client";

import { useEffect, useState } from "react";

import type { Supplier } from "./supplierMetrics";

// One fetch of /api/suppliers for the whole app, started the first time a page that needs the
// dataset becomes visible. Home never triggers it.
let pending: Promise<Supplier[]> | null = null;

function loadSuppliers() {
  pending ??= fetch("/api/suppliers")
    .then((response) => response.json() as Promise<Supplier[]>)
    .catch(() => {
      pending = null;
      return [] as Supplier[];
    });
  return pending;
}

export function useSuppliers(active: boolean) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!active || loaded) return;
    let cancelled = false;
    loadSuppliers().then((rows) => {
      if (cancelled) return;
      setSuppliers(rows);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [active, loaded]);

  return { suppliers, loaded };
}
