// panes/control.tsx — Control pane (actions). Bordered+titled, focused=borderActive per §4 UI doctrine.
import type { JSX } from "solid-js";
import { useTheme } from "../../context/theme.tsx";
import { useTaudeskState } from "../state.tsx";
import { PaneErrorBoundary } from "./fallback.tsx";

type ControlProps = {
  focused: boolean;
  width: number;
  children?: JSX.Element;
};

export function ControlPane(props: ControlProps) {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const isFocused = () => props.focused || state.focus.get() === "control";

  return (
    <box
      width={props.width}
      height="100%"
      borderStyle="rounded"
      borderColor={isFocused() ? theme.borderActive : theme.border}
      flexDirection="column"
      title=" Control "
      titleAlignment="left"
      onMouseDown={() => state.focus.set("control")}
    >
      <PaneErrorBoundary pane="control">
        <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1} overflow="hidden">
          {props.children}
        </box>
      </PaneErrorBoundary>
    </box>
  );
}
