// panes/observability.tsx — Observability pane (confirmations, diff, verify, switcher, PTY, tools)
import type { JSX } from "solid-js";
import { useTheme } from "../../context/theme.tsx";
import { useTaudeskState } from "../state.tsx";
import { PaneErrorBoundary } from "./fallback.tsx";

type ObservabilityProps = {
  focused: boolean;
  width: number;
  children?: JSX.Element;
};

export function ObservabilityPane(props: ObservabilityProps): JSX.Element {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const isFocused = () => props.focused || state.focus.get() === "observability";

  return (
    <box
      width={props.width}
      height="100%"
      borderStyle="rounded"
      borderColor={isFocused() ? theme.borderActive : theme.border}
      flexDirection="column"
      title=" Observability "
      titleAlignment="left"
      onMouseDown={() => state.focus.set("observability")}
    >
      <PaneErrorBoundary pane="observability">
        <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1} gap={1} overflow="hidden">
          {props.children}
        </box>
      </PaneErrorBoundary>
    </box>
  );
}
