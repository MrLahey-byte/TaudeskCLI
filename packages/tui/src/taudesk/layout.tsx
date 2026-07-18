// layout.tsx — three-pane shell. Geometry memo over live width; contextVisible = hidden?false : pinned?true : three-pane-tier
import { createMemo, Show } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";
import { useTheme } from "../context/theme.tsx";
import { computePaneGeometry, type PaneGeometry } from "./geometry.ts";
import { useTaudeskState } from "./state.tsx";
import { ContextPane } from "./panes/context.tsx";
import { ControlPane } from "./panes/control.tsx";
import { ObservabilityPane } from "./panes/observability.tsx";
import { SwitcherView } from "./views/switcher.tsx";
import { CommandsView } from "./views/commands.tsx";
import { DiffView } from "./views/diff.tsx";
import { ThinkingView } from "./views/thinking.tsx";
import { VerifyView } from "./views/verify.tsx";
import { KeybindsView } from "./views/keybinds.tsx";
import { TaudeskPluginRegistry } from "./plugin/registry.ts";

export function TaudeskLayout(props: { children?: unknown; pluginRegistry?: TaudeskPluginRegistry }) {
  const { theme } = useTheme();
  const dims = useTerminalDimensions();
  const state = useTaudeskState();
  const width = () => dims().width;
  const geometry = createMemo<PaneGeometry>(() => computePaneGeometry(width()));

  const contextVisible = createMemo(() => {
    const mode = state.config().contextMode ?? "auto";
    if (mode === "hidden") return false;
    if (mode === "pinned") return true;
    return geometry().tier === "three-pane";
  });

  createMemo(() => {
    const g = geometry();
    const visible = new Set<string>();
    if (g.tier === "three-pane") { visible.add("context"); visible.add("control"); visible.add("observability"); }
    else if (g.tier === "two-pane") { visible.add("control"); visible.add("observability"); }
    else { visible.add("control"); }
    const cur = state.focus.get();
    if (!visible.has(cur)) state.focus.set("control");
  });

  const controlWidth = createMemo(() => geometry().control);
  const registry = () => props.pluginRegistry;
  const innerChildren = () => props.children;

  return (
    <box width={width()} height="100%" flexDirection="row" backgroundColor={theme.background} gap={1}>
      <Show when={contextVisible()}>
        <ContextPane focused={state.focus.get() === "context"} width={geometry().context} visible={contextVisible()} />
      </Show>
      <ControlPane focused={state.focus.get() === "control"} width={controlWidth()}>
        {innerChildren() as never}
      </ControlPane>
      <Show when={geometry().tier !== "stacked"}>
        <ObservabilityPane focused={state.focus.get() === "observability"} width={geometry().observability}>
          <box flexDirection="column" flexGrow={1} gap={1} overflow="hidden">
            <SwitcherView />
            <DiffView />
            <VerifyView />
            <ThinkingView />
            <CommandsView />
            <KeybindsView />
            <Show when={registry()}>
              <box flexDirection="column" gap={1}>
                {(() => {
                  const views = registry()!.listBySlot("observability");
                  return views.map((v) => {
                    const C: any = v.component;
                    // Call as function to avoid JSX component typecheck — returns unknown/JSX
                    const rendered = (() => { try { return C({ session_id: "" }); } catch { return null; } })();
                    return (
                      <box flexDirection="column" borderStyle="rounded" borderColor={(theme as any).border} title={` ${v.title} `}>
                        {rendered as never}
                      </box>
                    );
                  });
                })() as never}
              </box>
            </Show>
          </box>
        </ObservabilityPane>
      </Show>
    </box>
  );
}
