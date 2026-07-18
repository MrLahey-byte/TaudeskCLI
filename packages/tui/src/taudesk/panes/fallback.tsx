// panes/fallback.tsx — ErrorBoundary per pane + empty fallback
import { ErrorBoundary, type JSX } from "solid-js";

type FallbackProps = { pane: string };

export function PaneFallback(props: FallbackProps): JSX.Element {
  return (
    <box flexGrow={1} padding={1}>
      <text fg="error">[{props.pane} error]</text>
    </box>
  );
}

type ErrorBoundaryProps = {
  pane: string;
  children: JSX.Element;
};

export function PaneErrorBoundary(props: ErrorBoundaryProps): JSX.Element {
  return (
    <ErrorBoundary fallback={() => <PaneFallback pane={props.pane} />}>
      {props.children}
    </ErrorBoundary>
  );
}
