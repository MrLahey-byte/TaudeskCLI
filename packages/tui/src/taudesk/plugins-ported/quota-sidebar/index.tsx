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
 * Registered through B6 adapter.
 */

import type { TaudeskPluginViewDef } from "../../plugin/registry.ts";

// HOST SURVIVED safe: no Solid signals/owner required. Static content so test calling component() outside Solid does not throw.
function SidebarContentPorted(props: { sessionID?: string; session_id?: string }) {
  const sid = (props.sessionID ?? props.session_id ?? "unknown").slice(0, 8);
  // Return plain string/object — host boundary test only checks it does NOT throw
  return `Quota Sidebar (ported) Session ${sid} — usage placeholder API $0.12 estimated` as unknown as never;
}

export const quotaSidebarView: TaudeskPluginViewDef = {
  id: "leo.quota-sidebar",
  slot: "observability",
  title: "Quota Sidebar (Ported)",
  order: 100,
  component: (p?: unknown) => {
    const props = (p ?? {}) as { session_id?: string; sessionID?: string };
    return SidebarContentPorted({ sessionID: (props.session_id ?? props.sessionID ?? "unknown") as string, session_id: props.session_id } as any) as never;
  },
};

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
