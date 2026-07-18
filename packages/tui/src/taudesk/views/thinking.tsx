// views/thinking.tsx — thinking stream, wired from session.next.reasoning.*
import { createSignal, For, onCleanup } from "solid-js";
import { useTaudeskState } from "../state.tsx";
import { useTheme } from "../../context/theme.tsx";

type ThinkingEntry = { id: string; text: string; kind: "started" | "delta" | "ended"; ts: number };

export function ThinkingView() {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const [items, setItems] = createSignal<ThinkingEntry[]>([]);

  const off = state.bus.on("thinking", (evt) => {
    const data = evt.data as { kind?: string; text?: string; id?: string } | undefined;
    const kind = (data?.kind ?? "delta") as ThinkingEntry["kind"];
    const entry: ThinkingEntry = {
      id: data?.id ?? `${Date.now()}_${Math.random()}`,
      text: (data?.text ?? "") as string,
      kind,
      ts: evt.ts,
    };
    setItems((prev) => {
      const next = [...prev, entry];
      if (next.length > 200) next.shift();
      return next;
    });
  });
  onCleanup(off);

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Thinking</text>
      <For each={items()}>
        {(item) => <text fg="textMuted" attributes={4 /* ITALIC */}>{item.text.slice(0, 200)}</text>}
      </For>
    </box>
  );
}
