// views/diff.tsx — diff + suggest, NEVER commits
import { createSignal, For, onCleanup, Show } from "solid-js";
import { useTaudeskState } from "../state.tsx";
import { useTheme } from "../../context/theme.tsx";
import { suggestCommitMessage } from "../suggest.ts";

type DiffFile = { file: string; add: number; del: number; patch?: string };

export function DiffView() {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const [files, setFiles] = createSignal<DiffFile[]>([]);

  const off = state.bus.on("diff", (evt) => {
    const data = evt.data as { files?: DiffFile[]; diff?: string; file?: string } | undefined;
    if (!data) return;
    if (Array.isArray(data.files)) {
      setFiles(data.files);
    } else if (data.file) {
      setFiles((prev) => [...prev, { file: data.file as string, add: 0, del: 0, patch: (data as { patch?: string }).patch }]);
    }
  });
  onCleanup(off);

  const suggestion = () => suggestCommitMessage(files().map((f) => ({ file: f.file, add: f.add, del: f.del })));

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Diff</text>
      <For each={files()}>
        {(f) => (
          <box flexDirection="row" gap={1}>
            <text fg="text">{f.file}</text>
            <Show when={f.add > 0}><text fg="diffAdded"> +{f.add}</text></Show>
            <Show when={f.del > 0}><text fg="diffRemoved"> -{f.del}</text></Show>
          </box>
        )}
      </For>
      <Show when={files().length > 0}>
        <box flexDirection="column" gap={1} marginTop={1}>
          <text fg="textMuted">Suggested commit:</text>
          <text fg="secondary">{suggestion()}</text>
        </box>
      </Show>
    </box>
  );
}
