// views/system-prompt.tsx — core view (not plugin), visible + live-editable no flag/config lookup.
// edit mutates signal; gate injects; FS only in bootstrap.

import { createSignal } from "solid-js";
import { useTheme } from "../../context/theme.tsx";
import { useTaudeskState } from "../state.tsx";

export function SystemPromptView() {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal(state.systemPrompt() ?? "");

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg="text" attributes={1 /* BOLD */}>System Prompt</text>
        <text fg="textMuted" onMouseDown={() => { setEditing(!editing()); setDraft(state.systemPrompt()); }}> [edit]</text>
      </box>
      <box>
        {editing() ? (
          <box flexDirection="column" gap={1}>
            <text fg="textMuted">{draft()}</text>
            <box flexDirection="row" gap={1}>
              <text fg="success" onMouseDown={() => { state.setSystemPrompt(draft()); setEditing(false); }}>Save</text>
              <text fg="textMuted" onMouseDown={() => setEditing(false)}>Cancel</text>
            </box>
          </box>
        ) : (
          <text fg="textMuted" attributes={4 /* ITALIC */}>{state.systemPrompt() || "(default)"}</text>
        )}
      </box>
    </box>
  );
}
