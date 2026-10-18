"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// The dashboard's path lives in the URL hash (#widgets/<card>/<panel>): the browser's back button works,
// and changing it never triggers a Next.js navigation.
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useHashPath(): [string[], (path: string[]) => void] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const path = useMemo(() => hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent), [hash]);
  const go = useCallback((next: string[]) => {
    window.location.hash = next.map(encodeURIComponent).join("/");
  }, []);
  return [path, go];
}

/** Path of a maximized widget (or one panel of a composite). */
export function widgetPath(toolCallId: string, panel?: number): string[] {
  return panel === undefined ? ["widgets", toolCallId] : ["widgets", toolCallId, String(panel)];
}
