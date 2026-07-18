// views/identity.tsx — provider/model identity, reads via bus wiring (identity topic)
import { createSignal, onCleanup } from "solid-js";
import { useTaudeskState } from "../state.tsx";

type IdentityPayload = {
  model?: string;
  provider?: string;
  agent?: string;
};

export function IdentityView() {
  const state = useTaudeskState();
  const [model, setModel] = createSignal<string>("(none)");
  const [agent, setAgent] = createSignal<string>("(none)");

  const off = state.bus.on("identity", (event) => {
    const payload = event.data as IdentityPayload | undefined;
    if (!payload) return;
    if (payload.model || payload.provider) {
      const provider = payload.provider ?? "";
      const modelName = payload.model ?? "";
      const combined = `${provider}/${modelName}`.replace(/^\//, "").replace(/\/$/, "");
      setModel(combined || "(none)");
    }
    if (payload.agent) setAgent(payload.agent);
  });
  onCleanup(off);

  return (
    <box flexDirection="row" gap={1}>
      <text fg="textMuted">Agent:</text>
      <text fg="text">{agent()}</text>
      <text fg="textMuted">·</text>
      <text fg="text">{model()}</text>
    </box>
  );
}
