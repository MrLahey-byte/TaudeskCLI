// panes/observability.tsx — Observability pane (confirmations, diff, verify, switcher, PTY, tools)
import { useTheme } from "../../context/theme.tsx";
import { useTaudeskState } from "../state.tsx";
import { PaneErrorBoundary } from "./fallback.tsx";

export function ObservabilityPane(props: { focused: boolean; width: number; children?: unknown }) {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const focused = () => props.focused || state.focus.get() === "observability";
  const borderColor = () => (focused() ? theme.borderActive : theme.border);

  return (
    <box
      width={props.width}
      height="100%"
      borderStyle="rounded"
      borderColor={borderColor()}
      flexDirection="column"
      title=" Observability "
      titleAlignment="left"
      onMouseDown={() => state.focus.set("observability")}
    >
      <PaneErrorBoundary pane="observability">
        <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1} gap={1} overflow="hidden">
          {props.children as never}
        </box>
      </PaneErrorBoundary>
    </box>
  );
}
