// panes/control.tsx — Control pane (actions). Bordered + titled.
import { useTheme } from "../../context/theme.tsx";
import { useTaudeskState } from "../state.tsx";
import { PaneErrorBoundary } from "./fallback.tsx";

export function ControlPane(props: { focused: boolean; width: number; children?: unknown }) {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const focused = () => props.focused || state.focus.get() === "control";
  const borderColor = () => (focused() ? theme.borderActive : theme.border);

  return (
    <box
      width={props.width}
      height="100%"
      borderStyle="rounded"
      borderColor={borderColor()}
      flexDirection="column"
      title=" Control "
      titleAlignment="left"
      onMouseDown={() => state.focus.set("control")}
    >
      <PaneErrorBoundary pane="control">
        <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1} overflow="hidden">
          {props.children as never}
        </box>
      </PaneErrorBoundary>
    </box>
  );
}
