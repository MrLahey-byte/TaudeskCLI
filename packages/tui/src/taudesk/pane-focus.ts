// pane-focus.ts — pure factory, no Solid dependency.
// Why factory not signal: usable in pure tests without Solid owner; focus repair moves to Control when focused pane disappears on shrink.

export type PaneId = "context" | "control" | "observability";

export type PaneFocusState = {
  get: () => PaneId;
  set: (pane: PaneId) => void;
  cycle: (dir: 1 | -1) => PaneId;
  subscribe: (cb: (pane: PaneId) => void) => () => void;
  repair: (visible: Set<PaneId>) => PaneId;
};

const ORDER: PaneId[] = ["context", "control", "observability"];

export function createPaneFocusState(initial: PaneId = "control"): PaneFocusState {
  let current: PaneId = initial;
  const subscribers = new Set<(pane: PaneId) => void>();

  function notify() {
    for (const subscriber of subscribers) {
      try {
        subscriber(current);
      } catch (error) {
        // Why log-and-continue here: one bad subscriber must not break focus propagation for others per pub/sub contract.
        // Tradeoff: error is observable via console.error rather than silent swallow per anti-slop rule.
        console.error("[taudesk focus] subscriber error", error);
      }
    }
  }

  return {
    get: () => current,
    set: (pane: PaneId) => {
      if (current !== pane) {
        current = pane;
        notify();
      }
    },
    cycle: (dir: 1 | -1) => {
      let idx = ORDER.indexOf(current);
      if (idx === -1) idx = 1;
      idx = (idx + dir + ORDER.length) % ORDER.length;
      current = ORDER[idx];
      notify();
      return current;
    },
    subscribe: (cb: (pane: PaneId) => void) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    repair: (visible: Set<PaneId>) => {
      if (!visible.has(current)) {
        current = "control";
        if (!visible.has(current)) {
          const fallback = ORDER.find((p) => visible.has(p)) ?? "control";
          current = fallback;
        }
        notify();
      }
      return current;
    },
  };
}
