// views/verify.tsx — verify runner output, redacted per runner (G3)
import { For, Show } from "solid-js";
import { useTaudeskEvents } from "./use-taudesk-events.ts";

type VerifyRow = { name: string; kind: "started" | "output" | "exited"; chunk?: string; exitCode?: number };

export function VerifyView() {
  const rows = useTaudeskEvents<VerifyRow>("verify", (event) => event.data as VerifyRow, 500);

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Verify</text>
      <For each={rows()}>
        {(entry) => (
          <box flexDirection="column">
            <Show when={entry.kind === "started"}><text fg="accent">▶ {entry.name} started</text></Show>
            <Show when={entry.kind === "output"}><text fg="textMuted">{entry.chunk?.slice(0, 300)}</text></Show>
            <Show when={entry.kind === "exited"}><text fg={entry.exitCode === 0 ? "success" : "error"}>{entry.name} exited {entry.exitCode}</text></Show>
          </box>
        )}
      </For>
      <Show when={rows().length === 0}><text fg="textMuted">No verify runs</text></Show>
    </box>
  );
}
