// bus.ts — imperative shell, thin glue. Owns redaction at publish.
// Spec requires safe() to isolate subscriber failures so one bad handler never breaks rest.
// Redaction at publish except pty topic (exempt by design, live byte stream not line-regex territory).

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

  // Safe dispatch — why: one bad subscriber must not break others per spec §4 Bus caps safe()
  // Tradeoff: we log to console.error for observability rather than silently dropping — not debug leftover.
  function safe(run: () => void | Promise<void>) {
    try {
      const r = run();
      if (r instanceof Promise) {
        r.catch((e) => {
          // Keep alive, observable failure — async subscriber threw
          console.error("[taudesk bus] subscriber async error", e);
        });
      }
    } catch (e) {
      // Keep alive — sync subscriber threw, isolated
      console.error("[taudesk bus] subscriber sync error", e);
    }
  }

  function publish(topic: TaudeskTopic, data: unknown) {
    const redacted = topic === "pty" ? data : redactValue(data);
    const frozen = Object.freeze({ topic, data: redacted, revision: ++revision, ts: Date.now() } as BusEvent);

    if (topic === "tool") {
      tools.push(redacted);
      while (tools.length > (CAPS.tool ?? 300)) tools.shift();
    } else if (topic === "thinking") {
      thinking.push(redacted);
      while (thinking.length > (CAPS.thinking ?? 200)) thinking.shift();
    }

    history.push(frozen as BusEvent);
    while (history.length > maxHistory) history.shift();

    const topicSubs = subs.get(topic);
    if (topicSubs) {
      for (const cb of topicSubs) safe(() => cb(frozen as BusEvent));
    }
    for (const cb of allSubs) safe(() => cb(frozen as BusEvent));
  }

  function on(topic: TaudeskTopic, cb: BusSubscriber): () => void {
    let set = subs.get(topic);
    if (!set) {
      set = new Set();
      subs.set(topic, set);
    }
    set.add(cb);
    return () => {
      // Why optional chain: set may have been cleared between subscribe/unsubscribe races
      const current = subs.get(topic);
      current?.delete(cb);
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
    get history() { return history.slice(); },
    get tools() { return tools.slice(); },
    get thinking() { return thinking.slice(); },
    get revision() { return revision; },
    safe,
    _internal: { redactText, redactValue },
  };
}

export type TaudeskBus = ReturnType<typeof createTaudeskBus>;
