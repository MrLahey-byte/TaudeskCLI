// views/diff.tsx — diff + suggest, NEVER commits (G6)
import { For, Show } from "solid-js";
import { useTaudeskEvents } from "./use-taudesk-events.ts";
import { suggestCommitMessage } from "../suggest.ts";

type DiffPayload = {
  files?: { file: string; add: number; del: number; patch?: string }[];
  file?: string;
  patch?: string;
};

type DiffFile = { file: string; add: number; del: number; patch?: string };

export function DiffView() {
  const files = useTaudeskEvents<DiffFile[]>("diff", (event) => {
    const payload = event.data as DiffPayload | undefined;
    if (!payload) return null;
    if (Array.isArray(payload.files)) return payload.files;
    if (payload.file) return [{ file: payload.file, add: 0, del: 0, patch: payload.patch }];
    return null;
  }, 500);

  const allFiles = () => files().flat();

  return (
    <box flexDirection="column" gap={1}>
      <text fg="accent" attributes={1}>Diff</text>
      <For each={allFiles()}>{(f) => <box flexDirection="row" gap={1}><text fg="text">{f.file}</text><Show when={f.add>0}><text fg="diffAdded"> +{f.add}</text></Show><Show when={f.del>0}><text fg="diffRemoved"> -{f.del}</text></Show></box>}</For>
      <Show when={allFiles().length>0}><box flexDirection="column" gap={1} marginTop={1}><text fg="textMuted">Suggested commit:</text><text fg="secondary">{suggestCommitMessage(allFiles().map(f=>({file:f.file,add:f.add,del:f.del})))}</text></box></Show>
    </box>
  );
}
