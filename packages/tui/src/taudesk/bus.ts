// bus.ts — imperative shell, thin glue. Owns redaction at publish, safe() both sync+async.
// I/O allowlist touches FS/process/dynamic-import: bootstrap, runner, config, gate, guard, plugin/host, pty/session, pty/*-backend.

import { redactValue, redactText } from "./redact.ts";

export type TaudeskTopic =
  | "tool"
  | "thinking"
  | "diff"
  | "identity"
  | "session"
  | "verify"
  | "checkout"
  | "pty"
  | "system"
  | "history"
  | string;

export type BusEvent = {
  topic: TaudeskTopic;
  data: unknown;
  revision: number;
  ts: number;
};

export type BusSubscriber = (event: BusEvent) => void | Promise<void>;

const CAPS: Record<string, number> = {
  tool: 300,
  thinking: 200,
  history: 500,
};

export function createTaudeskBus() {
  let revision = 0;
  const subs = new Map<TaudeskTopic, Set<BusSubscriber>>();
  const allSubs = new Set<BusSubscriber>();
  const history: BusEvent[] = [];
  const tools: unknown[] = [];
  const thinking: unknown[] = [];
  const maxHistory = 512;

  function safe(run: () => void | Promise<void>) {
    try {
      const r = run();
      if (r instanceof Promise) {
        r.catch((e) => {
          console.error("[taudesk bus] subscriber async error", e);
        });
      }
    } catch (e) {
      console.error("[taudesk bus] subscriber sync error", e);
    }
  }

  function publish(topic: TaudeskTopic, data: unknown) {
    // redactValue EXCEPT topic "pty" per spec
    const redacted = topic === "pty" ? data : redactValue(data);
    const frozen = Object.freeze({ topic, data: redacted, revision: ++revision, ts: Date.now() } as BusEvent);
    const evt = frozen as BusEvent;

    // caps shift-oldest per R3
    if (topic === "tool") {
      tools.push(redacted);
      while (tools.length > (CAPS.tool ?? 300)) tools.shift();
    } else if (topic === "thinking") {
      thinking.push(redacted);
      while (thinking.length > (CAPS.thinking ?? 200)) thinking.shift();
    }

    history.push(evt);
    while (history.length > maxHistory) history.shift();

    // dispatch via safe()
    const topicSubs = subs.get(topic);
    if (topicSubs) {
      for (const cb of topicSubs) {
        safe(() => cb(evt));
      }
    }
    for (const cb of allSubs) {
      safe(() => cb(evt));
    }
  }

  function on(topic: TaudeskTopic, cb: BusSubscriber): () => void {
    let set = subs.get(topic);
    if (!set) {
      set = new Set();
      subs.set(topic, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
    };
  }

  function subscribeAll(cb: BusSubscriber): () => void {
    allSubs.add(cb);
    return () => allSubs.delete(cb);
  }

  return {
    publish,
    on,
    subscribeAll,
    get history() {
      return history.slice();
    },
    get tools() {
      return tools.slice();
    },
    get thinking() {
      return thinking.slice();
    },
    get revision() {
      return revision;
    },
    // for testing: raw access to redacted behavior is via publish
    safe,
    // expose redaction verification: called at bus publish + verify runner
    _internal: { redactText, redactValue },
  };
}

export type TaudeskBus = ReturnType<typeof createTaudeskBus>;
