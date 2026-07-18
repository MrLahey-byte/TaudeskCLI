// state.tsx — imperative shell: per-instance signals. No module-level signals (leak).
import { createSignal, createContext, useContext, type ParentProps } from "solid-js";
import type { PaneId } from "./routing.ts";
import { createTaudeskBus, type TaudeskBus } from "./bus.ts";
import { createPaneFocusState, type PaneFocusState } from "./pane-focus.ts";
import type { TaudeskConfig } from "./config.ts";
import { DEFAULT_CONFIG } from "./config.ts";

export type TaudeskState = {
  bus: TaudeskBus;
  focus: PaneFocusState;
  config: () => TaudeskConfig;
  setConfig: (c: TaudeskConfig) => void;
  systemPrompt: () => string;
  setSystemPrompt: (s: string) => void;
  ptyTabs: () => PtyTabMeta[];
  setPtyTabs: (fn: (prev: PtyTabMeta[]) => PtyTabMeta[]) => void;
};

export type PtyTabMeta = {
  id: string;
  title: string;
  status: "running" | "exited";
  pid?: number;
};

const TaudeskStateContext = createContext<TaudeskState>();

export function createTaudeskState(initialConfig: TaudeskConfig = DEFAULT_CONFIG): TaudeskState {
  const bus = createTaudeskBus();
  const focus = createPaneFocusState("control");
  const [config, setConfig] = createSignal<TaudeskConfig>(initialConfig);
  const [systemPrompt, setSystemPrompt] = createSignal<string>("");
  const [ptyTabs, setPtyTabsRaw] = createSignal<PtyTabMeta[]>([]);

  return {
    bus,
    focus,
    config,
    setConfig,
    systemPrompt,
    setSystemPrompt,
    ptyTabs,
    setPtyTabs: (fn) => setPtyTabsRaw(fn as never),
  };
}

export function TaudeskStateProvider(props: ParentProps<{ initialConfig?: TaudeskConfig; state?: TaudeskState }>) {
  const state = props.state ?? createTaudeskState(props.initialConfig ?? DEFAULT_CONFIG);
  return (
    <TaudeskStateContext.Provider value={state}>{props.children}</TaudeskStateContext.Provider>
  );
}

export function useTaudeskState(): TaudeskState {
  const ctx = useContext(TaudeskStateContext);
  if (!ctx) throw new Error("useTaudeskState must be inside TaudeskStateProvider");
  return ctx;
}
