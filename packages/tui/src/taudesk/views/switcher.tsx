// views/switcher.tsx — session/subagent switcher (Observability — routing exception B2)
// direct-select 1-9 + mouse, reads sync.data.session.filter(parentID) + sync.session.status(id)
// status READ from existing sync; computing new status = banned bespoke view (G11)
import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";
import { useSync } from "../../context/sync.tsx";
import { useRoute } from "../../context/route.tsx";
import { useTheme } from "../../context/theme.tsx";
import { useTaudeskState } from "../state.tsx";

export function SwitcherView() {
  const { theme } = useTheme();
  const sync = useSync();
  const route = useRoute();
  const state = useTaudeskState();

  const sessions = createMemo(() => {
    const all = (sync.data as { session?: { id: string; parentID?: string; title: string }[] }).session ?? [];
    return all;
  });

  const parentSessions = createMemo(() => sessions().filter((s) => !s.parentID));
  const currentId = () => (route.data.type === "session" ? (route.data as { sessionID: string }).sessionID : undefined);

  const statusGlyph = (id: string) => {
    // Read from existing sync.session.status if available
    const getter = (sync as unknown as { session?: { status?: (id: string) => { type?: string } }; data?: { session_status?: Record<string, { type: string }> } });
    try {
      const st = getter.session?.status?.(id) ?? (getter.data as { session_status?: Record<string, { type: string }> })?.session_status?.[id];
      const type = st?.type ?? "idle";
      if (type === "running") return "○";
      if (type === "idle") return "●";
      return "◐";
    } catch {
      return "○";
    }
  };

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Sessions</text>
      <For each={parentSessions().slice(0, 9)}>
        {(s, idx) => {
          const n = idx() + 1;
          const isActive = () => currentId() === s.id;
          return (
            <box
              flexDirection="row"
              gap={1}
              backgroundColor={isActive() ? (theme as any).selected ?? (theme as any).backgroundElement : undefined}
              onMouseDown={() => route.navigate({ type: "session", sessionID: s.id })}
            >
              <text fg={isActive() ? "selectedListItemText" : "textMuted"}>{n}</text>
              <text fg={isActive() ? "accent" : "textMuted"}>{statusGlyph(s.id)}</text>
              <text fg={isActive() ? "selectedListItemText" : "text"}>{s.title.slice(0, 40)}</text>
              <Show when={isActive()}><text fg="accent"> ◀</text></Show>
            </box>
          );
        }}
      </For>
      <Show when={sessions().length === 0}>
        <text fg="textMuted">No sessions</text>
      </Show>
    </box>
  );
}
