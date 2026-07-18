// views/switcher.tsx — session/subagent switcher (Observability, routing exception B2)
// Why in Observability: session-switcher is action-category but sited in Obs BY DESIGN per routing.ts EXCEPTIONS frozen

import { For, Show, createMemo } from "solid-js";
import { useSync } from "../../context/sync.tsx";
import { useRoute } from "../../context/route.tsx";
import { useTheme } from "../../context/theme.tsx";

type SessionRow = {
  id: string;
  parentID?: string;
  title: string;
};

type SessionStatusLike = {
  session?: { status?: (id: string) => { type?: string } };
  data?: { session_status?: Record<string, { type?: string }> };
};

function readSessionStatus(sync: SessionStatusLike, id: string): string {
  try {
    const fromSessionApi = sync.session?.status?.(id);
    const fromData = sync.data?.session_status?.[id];
    return fromSessionApi?.type ?? fromData?.type ?? "idle";
  } catch {
    // Why fallback to "○": status READ must never throw — computing new status is banned bespoke view per G11
    return "idle";
  }
}

function glyphFromStatus(type: string): string {
  if (type === "running") return "○";
  if (type === "idle") return "●";
  return "◐";
}

export function SwitcherView() {
  const { theme } = useTheme();
  const sync = useSync() as unknown as SessionStatusLike & { data: { session: SessionRow[] } };
  const route = useRoute();

  const sessions = createMemo<SessionRow[]>(() => {
    const all = (sync as { data: { session?: SessionRow[] } }).data.session ?? [];
    return all;
  });

  const parentSessions = createMemo(() => sessions().filter((s) => !s.parentID));
  const currentId = () => (route.data.type === "session" ? (route.data as { sessionID: string }).sessionID : undefined);

  const statusGlyph = (id: string) => glyphFromStatus(readSessionStatus(sync, id));
  const selectedBg = () => {
    const themeAny = theme as unknown as { selected?: string; backgroundElement?: string };
    return themeAny.selected ?? themeAny.backgroundElement;
  };

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Sessions</text>
      <For each={parentSessions().slice(0, 9)}>
        {(sessionRow, idx) => {
          const number = idx() + 1;
          const isActive = () => currentId() === sessionRow.id;
          return (
            <box flexDirection="row" gap={1} backgroundColor={isActive() ? selectedBg() : undefined} onMouseDown={() => route.navigate({ type: "session", sessionID: sessionRow.id })}>
              <text fg={isActive() ? "selectedListItemText" : "textMuted"}>{number}</text>
              <text fg={isActive() ? "accent" : "textMuted"}>{statusGlyph(sessionRow.id)}</text>
              <text fg={isActive() ? "selectedListItemText" : "text"}>{sessionRow.title.slice(0, 40)}</text>
              <Show when={isActive()}><text fg="accent"> ◀</text></Show>
            </box>
          );
        }}
      </For>
      <Show when={sessions().length === 0}><text fg="textMuted">No sessions</text></Show>
    </box>
  );
}
