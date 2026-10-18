"use client";

import { agentLabel } from "./agents";
import { CardShell } from "./cards/CardShell";
import { useDashboard } from "./DashboardContext";
import { useHashPath, widgetPath } from "./useHashPath";

// Dashboard: a grid of widget previews (newest first). Opening one maximizes it over the whole right side,
// with its path on top: Widgets / Total risk, or Widgets / <composite> / <panel> for one panel of a composite.
export function Dashboard() {
  const { notices, cards, removeCard } = useDashboard();
  const [path, go] = useHashPath();
  const [, openId, panelParam] = path;
  const open = cards.find((c) => c.toolCallId === openId);

  if (open) {
    const panels = open.card.panels ?? [];
    const panelIndex = panelParam === undefined ? undefined : Number(panelParam);
    const panel = panelIndex !== undefined && panels[panelIndex] ? panels[panelIndex] : undefined;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <nav aria-label="Widget path" className="flex items-center gap-1 border-b border-black/10 px-6 py-2.5 text-sm dark:border-white/10">
          <Crumb onClick={() => go(["widgets"])}>Widgets</Crumb>
          <span className="text-black/30 dark:text-white/30">/</span>
          {panel ? (
            <>
              <Crumb onClick={() => go(widgetPath(open.toolCallId))}>{open.card.title}</Crumb>
              <span className="text-black/30 dark:text-white/30">/</span>
              <span className="truncate font-medium">{panel.title}</span>
            </>
          ) : (
            <span className="truncate font-medium">{open.card.title}</span>
          )}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <CardShell
            key={panel ? `${open.toolCallId}/${panelIndex}` : open.toolCallId}
            card={panel ?? open.card}
            mode="full"
            onOpenPanel={panel ? undefined : (i) => go(widgetPath(open.toolCallId, i))}
            onClose={
              panel
                ? undefined
                : () => {
                    removeCard(open.toolCallId);
                    go(["widgets"]);
                  }
            }
          />
        </div>
      </div>
    );
  }

  if (notices.length === 0 && cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-black/50 dark:text-white/50">
        Ask a Buddy something… results will appear here.
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto p-6">
      {cards.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          {cards.map(({ toolCallId, card }) => (
            <CardShell
              key={toolCallId}
              id={cardElementId(toolCallId)}
              card={card}
              mode="preview"
              onOpen={() => go(widgetPath(toolCallId))}
              onClose={() => removeCard(toolCallId)}
            />
          ))}
        </div>
      )}
      {notices.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {notices.map((notice) => (
            <article
              key={notice.id}
              className="rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
                Notice · {agentLabel(notice.agentId)}
              </p>
              <p className="mt-1 text-base">{notice.text}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Crumb({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="truncate rounded px-1 text-sky-700 hover:bg-sky-500/10 dark:text-sky-300">
      {children}
    </button>
  );
}

export function cardElementId(toolCallId: string) {
  return `card-${toolCallId}`;
}
