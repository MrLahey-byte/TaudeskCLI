import { expect, test } from "bun:test";
import { parseKeyCombo, matchesKeyCombo, normalizeKeyComboString } from "../../src/taudesk/keybind-parse.ts";
import { checkReservedConflict, DEFAULT_KEYBINDS } from "../../src/taudesk/keybind-conflicts.ts";

test("parse aliases ctrl|control, alt|option, meta|cmd|super|win", () => {
  const a = parseKeyCombo("control+shift+]");
  expect(a.ctrl).toBe(true);
  expect(a.shift).toBe(true);
  expect(a.name).toBe("]");

  const b = parseKeyCombo("option+a");
  expect(b.alt).toBe(true);

  const c = parseKeyCombo("cmd+b");
  expect(c.meta).toBe(true);

  const d = parseKeyCombo("super+c");
  expect(d.meta).toBe(true);

  const e = parseKeyCombo("win+d");
  expect(e.meta).toBe(true);
});

test("matches compares ALL FOUR modifiers + name (fabletau bug if ctrl-only)", () => {
  const parsed = parseKeyCombo("ctrl+shift+]");
  // correct match
  expect(matchesKeyCombo(parsed, { name: "]", ctrl: true, shift: true, alt: false, meta: false })).toBe(true);
  // wrong if only ctrl compared — shift missing should NOT match
  expect(matchesKeyCombo(parsed, { name: "]", ctrl: true, shift: false, alt: false, meta: false })).toBe(false);
  // ctrl+shift+tab vs ctrl+shift+] should not match because name differs
  expect(matchesKeyCombo(parsed, { name: "tab", ctrl: true, shift: true, alt: false, meta: false })).toBe(false);
});

test("normalization case/space/order", () => {
  expect(normalizeKeyComboString("SHIFT+Ctrl+ ]")).toBe("ctrl+shift+]");
});

test("defaults reserved-clean on every platform (T11 NC)", () => {
  for (const platform of ["win32", "linux", "darwin"] as const) {
    for (const [, combo] of Object.entries(DEFAULT_KEYBINDS)) {
      const conflict = checkReservedConflict(combo, platform);
      expect(conflict).toBeUndefined();
    }
  }
});
