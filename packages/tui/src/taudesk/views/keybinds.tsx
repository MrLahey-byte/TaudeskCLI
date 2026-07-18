// views/keybinds.tsx — loads config via same loader, shows checkReservedConflict inline ⚠
import { createSignal, For, Show, createMemo } from "solid-js";
import { useTaudeskState } from "../state.tsx";
import { useTheme } from "../../context/theme.tsx";
import { checkReservedConflict } from "../keybind-conflicts.ts";
import type { Platform } from "../keybind-conflicts.ts";

export function KeybindsView() {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const platform = (typeof process !== "undefined" ? process.platform : "linux") as Platform;
  const cfg = createMemo(() => state.config());

  const entries = createMemo(() => {
    const k = cfg().keybinds;
    return [
      { id: "pane_switch", combo: k.pane_switch },
      { id: "pane_switch_reverse", combo: k.pane_switch_reverse },
      { id: "terminal_toggle", combo: k.terminal_toggle },
    ];
  });

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Keybinds</text>
      <For each={entries()}>
        {(e) => {
          const conflict = checkReservedConflict(e.combo, platform);
          return (
            <box flexDirection="row" gap={1}>
              <text fg="textMuted">{e.id}</text>
              <text fg="text">{e.combo}</text>
              <Show when={conflict}><text fg="warning"> ⚠ {conflict}</text></Show>
            </box>
          );
        }}
      </For>
    </box>
  );
}
