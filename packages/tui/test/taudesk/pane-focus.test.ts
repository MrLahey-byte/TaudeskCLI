import { expect, test } from "bun:test";
import { createPaneFocusState } from "../../src/taudesk/pane-focus.ts";

test("createPaneFocusState initial control, get/set/cycle wraps, subscribe, repair moves to control if focused disappears", () => {
  const state = createPaneFocusState("control");
  expect(state.get()).toBe("control");

  let notified: string | undefined;
  const off = state.subscribe((p) => { notified = p; });

  state.set("context");
  expect(state.get()).toBe("context");
  expect(notified).toBe("context");

  // cycle wraps context->control->observability
  state.set("context");
  expect(state.cycle(1)).toBe("control");
  expect(state.cycle(1)).toBe("observability");
  expect(state.cycle(1)).toBe("context");
  expect(state.cycle(-1)).toBe("observability");

  // repair: if focused pane disappears on shrink, focus moves to Control
  state.set("context");
  const visible = new Set(["control", "observability"] as const);
  const repaired = state.repair(visible as unknown as Set<"context"|"control"|"observability">);
  expect(repaired).toBe("control");

  off();
});
