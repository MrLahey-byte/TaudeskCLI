// plugin/host.tsx — builds view adapter OVER existing plugin discovery/runtime/lifecycle. No second loader.
// Privilege: no route/dialog mutation, no tool-exec interception, no Context/Control state mutation, cannot bypass confirm prompts.
// Same-process JS is capability-limited, not sandboxed — documented honestly.

import { TaudeskPluginRegistry, TAUDESK_PLUGIN_API_VERSION, type TaudeskPluginViewDef } from "./registry.ts";

export type TaudeskPluginHostApi = {
  apiVersion: string;
  registerView: (def: TaudeskPluginViewDef) => void;
  events: {
    subscribe: (cb: (evt: { topic: string; data: unknown }) => void) => () => void;
    history: () => readonly { topic: string; data: unknown; revision: number; ts: number }[];
  };
  session: {
    current: () => { id?: string; title?: string } | undefined;
  };
  theme: Readonly<Record<string, unknown>>;
};

export function createTaudeskPluginHost(opts: {
  registry: TaudeskPluginRegistry;
  bus?: { subscribeAll: (cb: (evt: { topic: string; data: unknown; revision: number; ts: number }) => void) => () => void; history: readonly { topic: string; data: unknown; revision: number; ts: number }[] };
  getSession?: () => { id?: string; title?: string } | undefined;
  theme?: Record<string, unknown>;
}): { api: TaudeskPluginHostApi; registry: TaudeskPluginRegistry } {
  const registry = opts.registry;

  const api: TaudeskPluginHostApi = Object.freeze({
    apiVersion: TAUDESK_PLUGIN_API_VERSION,
    registerView: (def: TaudeskPluginViewDef) => {
      registry.register(Object.freeze({ ...def, component: def.component }) as TaudeskPluginViewDef);
    },
    events: Object.freeze({
      subscribe: (cb: (evt: { topic: string; data: unknown }) => void) => {
        if (opts.bus) {
          const off = opts.bus.subscribeAll(cb as never);
          return off;
        }
        return () => {};
      },
      history: () => {
        if (opts.bus) return Object.freeze([...opts.bus.history]) as readonly { topic: string; data: unknown; revision: number; ts: number }[];
        return Object.freeze([]) as readonly { topic: string; data: unknown; revision: number; ts: number }[];
      },
    }),
    session: Object.freeze({
      current: () => {
        const snap = opts.getSession?.();
        return snap ? Object.freeze({ ...snap }) : undefined;
      },
    }),
    theme: Object.freeze(opts.theme ?? {}),
  } as TaudeskPluginHostApi);

  return { api, registry };
}

export function createTaudeskPluginHostForTest() {
  const registry = new TaudeskPluginRegistry();
  const history: { topic: string; data: unknown; revision: number; ts: number }[] = [];
  const subs = new Set<(evt: { topic: string; data: unknown; revision: number; ts: number }) => void>();
  const bus = {
    subscribeAll: (cb: (evt: { topic: string; data: unknown; revision: number; ts: number }) => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    get history() {
      return history.slice();
    },
    publish: (topic: string, data: unknown) => {
      const evt = { topic, data, revision: history.length + 1, ts: Date.now() };
      history.push(evt);
      for (const cb of subs) {
        try { cb(evt); } catch {}
      }
    },
  };
  const host = createTaudeskPluginHost({ registry, bus, getSession: () => undefined, theme: {} });
  return { host, registry, bus, api: host.api };
}
