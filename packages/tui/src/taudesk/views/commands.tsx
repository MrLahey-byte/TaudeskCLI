// views/commands.tsx — tool stream, redacted
import { createSignal, For, onCleanup } from "solid-js";
import { useTaudeskState } from "../state.tsx";
import { useTheme } from "../../context/theme.tsx";

type ToolEntry = { id: string; tool: string; state: string; output?: string };

export function CommandsView() {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const [tools, setTools] = createSignal<ToolEntry[]>([]);

  const off = state.bus.on("tool", (evt) => {
    const data = evt.data as ToolEntry & { kind?: string } | undefined;
    if (!data) return;
    setTools((prev) => {
      const next = [...prev, { id: `${evt.revision}`, tool: (data as { tool?: string }).tool ?? (data as { kind?: string }).kind ?? "tool", state: (data as { state?: string }).state ?? "running", output: (data as { output?: string }).output }];
      if (next.length > 300) next.shift();
      return next;
    });
  });
  onCleanup(off);

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Tools</text>
      <For each={tools()}>
        {(t) => (
          <box flexDirection="row" gap={1}>
            <text fg={t.state === "completed" || t.state === "success" ? "success" : t.state === "failed" || t.state === "error" ? "error" : "accent"} attributes={1}>{t.tool}</text>
            <text fg="textMuted">{(t.output ?? "").slice(0, 100)}{(t.output?.length ?? 0) > 100 ? "..." : ""}</text>
          </box>
        )}
      </For>
    </box>
  );
}
