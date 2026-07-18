// panes/context.tsx — Context pane (lookup / identity). Bordered + titled, focused=borderActive.
import { Show, createMemo } from "solid-js";
import { useTheme } from "../../context/theme.tsx";
import { useTaudeskState } from "../state.tsx";
import { PaneErrorBoundary } from "./fallback.tsx";
import { SystemPromptView } from "../views/system-prompt.tsx";
import { IdentityView } from "../views/identity.tsx";
import { useSync } from "../../context/sync.tsx";

export function ContextPane(props: { focused: boolean; width: number; visible: boolean }) {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const focused = () => props.focused || state.focus.get() === "context";
  const borderColor = () => (focused() ? theme.borderActive : theme.border);
  const sync = useSync();

  return (
    <box
      width={props.width}
      height="100%"
      borderStyle="rounded"
      borderColor={borderColor()}
      flexDirection="column"
      title=" Context "
      titleAlignment="left"
      onMouseDown={() => state.focus.set("context")}
    >
      <PaneErrorBoundary pane="context">
        <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1} gap={1} overflow="hidden">
          <box flexShrink={0}>
            <SystemPromptView />
          </box>
          <box flexShrink={0}>
            <IdentityView />
          </box>
          <box flexGrow={1} flexDirection="column" overflow="hidden">
            <text fg="textMuted">Context</text>
            <Show when={state.systemPrompt()}>
              <text fg="text">{state.systemPrompt()}</text>
            </Show>
            <box flexDirection="column" marginTop={1}>
              <text fg="textMuted">Instruction file</text>
              <text fg="text">{sync.data.session.length} sessions</text>
            </box>
          </box>
        </box>
      </PaneErrorBoundary>
    </box>
  );
}
