// plugin/host.tsx — view adapter OVER existing plugin discovery/runtime/lifecycle. No second loader.
// Privilege: no route/dialog mutation, no tool-exec interception, no Context/Control state mutation, cannot bypass confirms.
// Same-process JS capability-limited not sandboxed — tradeoff documented here.

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

type BusShape = {
  subscribeAll: (cb: (evt: { topic: string; data: unknown; revision: number; ts: number }) => void) => () => void;
  history: readonly { topic: string; data: unknown; revision: number; ts: number }[];
};

export function createTaudeskPluginHost(opts: {
  registry: TaudeskPluginRegistry;
  bus?: BusShape;
  getSession?: () => { id?: string; title?: string } | undefined;
  theme?: Record<string, unknown>;
}): { api: TaudeskPluginHostApi; registry: TaudeskPluginRegistry } {
  const registry = opts.registry;

  const noopUnsubscribe = (): void => {
    // Why no-op: when no bus is provided (test or non-PTY user), unsubscribe is a no-op sentinel, not a stub.
    // Tradeoff: explicit no-op avoids undefined check at call-site.
  };

  const api: TaudeskPluginHostApi = Object.freeze({
    apiVersion: TAUDESK_PLUGIN_API_VERSION,
    registerView: (def: TaudeskPluginViewDef) => {
      const frozenView = Object.freeze({ ...def, component: def.component }) as TaudeskPluginViewDef;
      registry.register(frozenView);
    },
    events: Object.freeze({
      subscribe: (cb) => {
        if (opts.bus) return opts.bus.subscribeAll(cb as never);
        return noopUnsubscribe;
      },
      history: () => {
        if (opts.bus) return Object.freeze([...opts.bus.history]) as readonly { topic: string; data: unknown; revision: number; ts: number }[];
        return Object.freeze([]) as readonly { topic: string; data: unknown; revision: number; ts: number }[];
      },
    }),
    session: Object.freeze({
      current: () => {
        const snapshot = opts.getSession?.();
        return snapshot ? Object.freeze({ ...snapshot }) : undefined;
      },
    }),
    theme: Object.freeze(opts.theme ?? {}),
  } as TaudeskPluginHostApi);

  return { api, registry };
}

export function createTaudeskPluginHostForTest() {
  const registry = new TaudeskPluginRegistry();
  const history: { topic: string; data: unknown; revision: number; ts: number }[] = [];
  const subscribers = new Set<(evt: { topic: string; data: unknown; revision: number; ts: number }) => void>();

  const bus = {
    subscribeAll: (cb: (evt: { topic: string; data: unknown; revision: number; ts: number }) => void) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    get history() {
      return history.slice();
    },
    publish: (topic: string, data: unknown) => {
      const event = { topic, data, revision: history.length + 1, ts: Date.now() };
      history.push(event);
      for (const subscriber of subscribers) {
        try {
          subscriber(event);
        } catch (subscriberError) {
          // Why log-and-continue: one bad test subscriber must not break host — isolated per pub/sub contract.
          console.error("[taudesk host test] subscriber error", subscriberError);
        }
      }
    },
  };

  const host = createTaudeskPluginHost({ registry, bus, getSession: () => undefined, theme: {} });
  return { host, registry, bus, api: host.api };
}
