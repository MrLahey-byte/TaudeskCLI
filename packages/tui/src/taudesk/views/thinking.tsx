// views/thinking.tsx — thinking stream, wired from session.next.reasoning.* (R2 SDK type)
import { For } from "solid-js";
import { useTaudeskEvents } from "./use-taudesk-events.ts";

type ThinkingPayload = {
  kind?: string;
  text?: string;
  id?: string;
};

type ThinkingRow = {
  id: string;
  text: string;
  kind: "started" | "delta" | "ended";
  ts: number;
};

export function ThinkingView() {
  const rows = useTaudeskEvents<ThinkingRow>("thinking", (event) => {
    const payload = event.data as ThinkingPayload | undefined;
    return {
      id: payload?.id ?? `${event.revision}`,
      text: payload?.text ?? "",
      kind: (payload?.kind ?? "delta") as ThinkingRow["kind"],
      ts: event.ts,
    };
  }, 200);

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Thinking</text>
      <For each={rows()}>{(item) => <text fg="textMuted" attributes={4}>{item.text.slice(0, 200)}</text>}</For>
    </box>
  );
}
