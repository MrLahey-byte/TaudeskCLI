import { expect, test } from "bun:test";
import { shouldConsumeForPty } from "../../src/taudesk/pty/passthrough.ts";
import { PRIORITIES } from "../../src/taudesk/keybind-conflicts.ts";

test("passthrough early-return on pane-switch combo so priority wins (G14)", () => {
  const writes: string[] = [];
  const isPaneSwitch = (k: { name?: string; ctrl?: boolean; shift?: boolean; sequence?: string }) => {
    // matches ctrl+shift+] and ctrl+shift+[
    return !!(k.ctrl && k.shift && (k.name === "]" || k.name === "[" || k.sequence === "]" || k.sequence === "["));
  };
  const toBytes = (k: { name?: string; sequence?: string }) => k.sequence ?? k.name;
  const write = (b: string) => writes.push(b);

  // pane-switch combo -> return false so priority wins
  const switched = shouldConsumeForPty({ name: "]", ctrl: true, shift: true, sequence: "]" }, { isPaneSwitchCombo: isPaneSwitch, toBytes, write });
  expect(switched).toBe(false);
  expect(writes.length).toBe(0);

  // normal key -> true and writes
  const consumed = shouldConsumeForPty({ name: "a", sequence: "a" }, { isPaneSwitchCombo: isPaneSwitch, toBytes, write });
  expect(consumed).toBe(true);
  expect(writes).toContain("a");
});

test("priority ordering per R4: pane-switch 10000 > PTY passthrough 9000", () => {
  expect(PRIORITIES.PANE_SWITCH).toBeGreaterThan(PRIORITIES.PTY_PASSTHROUGH);
  expect(PRIORITIES.PANE_SWITCH).toBe(10000);
  expect(PRIORITIES.PTY_PASSTHROUGH).toBe(9000);
});
