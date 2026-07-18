// pane-focus.ts — pure factory (no Solid). Focus moves to Control if focused pane disappears on shrink.
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
  const subs = new Set<(pane: PaneId) => void>();
  function notify() {
    for (const cb of subs) {
      try { cb(current); } catch {}
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
      // wrap context→control→observability per spec
      idx = (idx + dir + ORDER.length) % ORDER.length;
      current = ORDER[idx];
      notify();
      return current;
    },
    subscribe: (cb: (pane: PaneId) => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    repair: (visible: Set<PaneId>) => {
      if (!visible.has(current)) {
        current = "control";
        // ensure control is visible if possible, else pick first visible
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
