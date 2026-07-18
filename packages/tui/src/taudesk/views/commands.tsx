// views/commands.tsx — tool stream, redacted per bus. Observability pane.

import { For } from "solid-js";
import { useTaudeskEvents } from "./use-taudesk-events.ts";

type ToolPayload = {
  tool?: string;
  kind?: string;
  state?: string;
  output?: string;
};

type ToolRow = {
  id: string;
  tool: string;
  state: string;
  output?: string;
};

export function CommandsView() {
  const toolRows = useTaudeskEvents<ToolRow>("tool", (event) => {
    const payload = event.data as ToolPayload | undefined;
    if (!payload) return null;
    return {
      id: `${event.revision}`,
      tool: payload.tool ?? payload.kind ?? "tool",
      state: payload.state ?? "running",
      output: payload.output,
    };
  }, 300);

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Tools</text>
      <For each={toolRows()}>
        {(row) => (
          <box flexDirection="row" gap={1}>
            <text
              fg={
                row.state === "completed" || row.state === "success"
                  ? "success"
                  : row.state === "failed" || row.state === "error"
                    ? "error"
                    : "accent"
              }
              attributes={1}
            >
              {row.tool}
            </text>
            <text fg="textMuted">
              {(row.output ?? "").slice(0, 100)}
              {(row.output?.length ?? 0) > 100 ? "..." : ""}
            </text>
          </box>
        )}
      </For>
    </box>
  );
}
