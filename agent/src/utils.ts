import type { ActivityStep, ResearchFinding, ResearchSource } from "./types.ts";

let seq = 0;

export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function activity(
  partial: Omit<ActivityStep, "id" | "at" | "status"> & {
    status?: ActivityStep["status"];
  },
): ActivityStep {
  return {
    id: uid("act"),
    at: nowIso(),
    status: partial.status ?? "running",
    ...partial,
  };
}

export function extractCompanyName(text: string): string {
  const trimmed = text.trim();
  const patterns = [
    /research\s+(.+?)(?:\s+and\b|\s+for\b|\.|$)/i,
    /company\s*(?:named|:)?\s*["']?([A-Za-z0-9][\w .,&'-]{1,80})/i,
    /look\s+(?:into|up)\s+(.+?)(?:\.|$)/i,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m?.[1]) return cleanCompany(m[1]);
  }
  if (trimmed.length > 0 && trimmed.length < 80 && !trimmed.includes("?")) {
    return cleanCompany(trimmed);
  }
  return "";
}

function cleanCompany(raw: string): string {
  return raw
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mergeSources(
  existing: ResearchSource[],
  incoming: ResearchSource[],
): ResearchSource[] {
  const seen = new Set(existing.map((s) => s.url));
  const out = [...existing];
  for (const s of incoming) {
    if (!seen.has(s.url)) {
      seen.add(s.url);
      out.push(s);
    }
  }
  return out;
}

export function replaceFinding(
  findings: ResearchFinding[],
  updated: ResearchFinding,
): ResearchFinding[] {
  return findings.map((f) => (f.id === updated.id ? updated : f));
}

export function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return "";
      })
      .join("");
  }
  return "";
}

export function parseJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
