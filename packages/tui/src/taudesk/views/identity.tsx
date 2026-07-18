// views/identity.tsx — provider/model identity, reads existing sync via bus wiring
import { createSignal, onCleanup, Show } from "solid-js";
import { useTaudeskState } from "../state.tsx";
import { useTheme } from "../../context/theme.tsx";

export function IdentityView() {
  const { theme } = useTheme();
  const state = useTaudeskState();
  const [model, setModel] = createSignal<string>("(none)");
  const [agent, setAgent] = createSignal<string>("(none)");

  const off1 = state.bus.on("identity", (evt) => {
    const d = evt.data as { model?: string; provider?: string; agent?: string; kind?: string } | undefined;
    if (!d) return;
    if (d.model || d.provider) {
      setModel(`${d.provider ?? ""}/${d.model ?? ""}`.replace(/^\//, ""));
    }
    if (d.agent) setAgent(d.agent);
  });
  onCleanup(off1);

  return (
    <box flexDirection="row" gap={1}>
      <text fg="textMuted">Agent:</text>
      <text fg="text">{agent()}</text>
      <text fg="textMuted">·</text>
      <text fg="text">{model()}</text>
    </box>
  );
}
