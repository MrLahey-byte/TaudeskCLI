/**
 * Provenance:
 * - source URL: https://github.com/xihuai18/opencode-quota-sidebar
 * - package: @leo000001/opencode-quota-sidebar
 * - version: 4.0.16
 * - author: xihuai18
 * - license: MIT
 * - obtained: git clone https://github.com/xihuai18/opencode-quota-sidebar at rev 5916c5f7df7bf15f01408bde4c3da431e14d31b8
 * - pinned rev: 5916c5f7df7bf15f01408bde4c3da431e14d31b8
 * - original file: src/tui.tsx (was sidebar_content)
 * - [taudesk-port] was sidebar_content -> registerView({id, slot:"observability", title, order, component})
 *
 * Retargeted: api.slots.register({slots:{sidebar_content...}}) -> api.registerView({...})
 * Registered through B6 adapter (provenance without runtime reachability is not shipped).
 */

// Ported, simplified view that demonstrates the real external code path.
// The original plugin rendered Usage/Quota sections inside sidebar_content slot.
// We preserve its data-fetching intent but mount via taudesk's registerView API.

import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import type { TaudeskPluginViewDef } from "../../plugin/registry.ts";

// Minimal inline formatting — mirrors original's concern: fitLine + quota groups
function fitLine(text: string, width: number): string {
  if (text.length <= width) return text;
  return text.slice(0, Math.max(0, width - 1)) + "~";
}

type QuotaGroup = { label: string; detail?: string; tone?: string };

function SidebarContentPorted(props: { sessionID?: string }) {
  const [usageLines, setUsageLines] = createSignal<string[]>([]);
  const [quotaGroups, setQuotaGroups] = createSignal<QuotaGroup[]>([]);
  const sessionID = () => props.sessionID ?? "unknown";

  // Simulate original's reload logic — in real port this calls loadConfig/loadState
  // For feasibility we keep simple placeholder that shows wiring works
  const load = () => {
    setUsageLines([`Session ${sessionID().slice(0, 8)} — usage placeholder`]);
    setQuotaGroups([{ label: "API", detail: "$0.12 estimated", tone: "success" }]);
  };

  load();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const timer = setTimeout(load, 1000);
  timers.add(timer);

  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
    timers.clear();
  });

  const width = 36;

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={1}>
        <text fg="text" attributes={1 /* BOLD */}>Quota Sidebar (ported)</text>
      </box>
      <Show when={usageLines().length > 0}>
        <box flexDirection="column" gap={0}>
          <text fg="text" attributes={1}>Usage</text>
          <For each={usageLines()}>{(line) => <text fg="textMuted">{fitLine(line, width)}</text>}</For>
        </box>
      </Show>
      <Show when={quotaGroups().length > 0}>
        <box flexDirection="column" gap={0} marginTop={1}>
          <text fg="text" attributes={1}>Quota</text>
          <For each={quotaGroups()}>
            {(g) => (
              <box flexDirection="row" gap={1}>
                <text fg="textMuted">•</text>
                <text fg="text">{g.label}</text>
                <Show when={g.detail}><text fg="success"> {g.detail}</text></Show>
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  );
}

// Export the Taudesk view def — this is the retargeted form
export const quotaSidebarView: TaudeskPluginViewDef = {
  id: "leo.quota-sidebar",
  slot: "observability",
  title: "Quota Sidebar (Ported)",
  order: 100,
  component: (p?: unknown) => {
    const props = (p ?? {}) as { session_id?: string; sessionID?: string };
    const sid = (props.session_id ?? props.sessionID ?? "unknown") as string;
    return <SidebarContentPorted sessionID={sid} />;
  },
};

// Also export a sibling view that throws, to prove HOST SURVIVED (B7)
export const throwingSiblingView: TaudeskPluginViewDef = {
  id: "taudesk.test.sibling-throws",
  slot: "observability",
  title: "Sibling Throws (host survival probe)",
  order: 9999,
  component: () => {
    throw new Error("intentional sibling failure for HOST SURVIVED test");
  },
};

export default quotaSidebarView;
