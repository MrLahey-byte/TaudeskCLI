// views/verify.tsx — verify runner output, redacted per runner
import { createSignal, For, onCleanup, Show } from "solid-js";
import { useTaudeskState } from "../state.tsx";
import { useTheme } from "../../context/theme.tsx";

type VerifyEntry = { name: string; kind: "started" | "output" | "exited"; chunk?: string; exitCode?: number };

export function VerifyView() {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const [entries, setEntries] = createSignal<VerifyEntry[]>([]);

  const off = state.bus.on("verify", (evt) => {
    const d = evt.data as VerifyEntry | undefined;
    if (!d) return;
    setEntries((prev) => {
      const next = [...prev, d];
      if (next.length > 500) next.shift();
      return next;
    });
  });
  onCleanup(off);

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Verify</text>
      <For each={entries()}>
        {(e) => (
          <box flexDirection="column">
            <Show when={e.kind === "started"}><text fg="accent">▶ {e.name} started</text></Show>
            <Show when={e.kind === "output"}><text fg="textMuted">{e.chunk?.slice(0, 300)}</text></Show>
            <Show when={e.kind === "exited"}><text fg={e.exitCode === 0 ? "success" : "error"}>{e.name} exited {e.exitCode}</text></Show>
          </box>
        )}
      </For>
      <Show when={entries().length === 0}><text fg="textMuted">No verify runs</text></Show>
    </box>
  );
}
