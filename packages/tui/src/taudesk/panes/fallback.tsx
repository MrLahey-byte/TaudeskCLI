// panes/fallback.tsx — ErrorBoundary per pane + empty fallback
import { ErrorBoundary } from "solid-js";

export function PaneFallback(props: { pane: string }) {
  return (
    <box flexGrow={1} padding={1}>
      <text fg="error">[{props.pane} error]</text>
    </box>
  );
}

export function PaneErrorBoundary(props: { pane: string; children: unknown }) {
  return (
    <ErrorBoundary fallback={() => <PaneFallback pane={props.pane} />}>
      {props.children as never}
    </ErrorBoundary>
  );
}
