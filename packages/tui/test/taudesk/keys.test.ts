import { expect, test } from "bun:test";
import { keyToPtyBytes, csi } from "../../src/taudesk/pty/keys.ts";

// csi() is only modifier calc — T12 NC: grep exactly one computation
test("csi R8 — mod = 1+(shift)+(alt*2)+(ctrl*4), meta excluded", () => {
  expect(csi("A", {})).toBe("\x1b[A");
  expect(csi("A", { shift: true })).toBe("\x1b[1;2A");
  expect(csi("A", { alt: true })).toBe("\x1b[1;3A");
  expect(csi("A", { ctrl: true })).toBe("\x1b[1;5A");
  expect(csi("A", { shift: true, ctrl: true })).toBe("\x1b[1;6A");
});

test("keyToPtyBytes printable, unicode, enter/backspace/ctrl-c/arrows/home/end/modifiers/app-cursor", () => {
  // printable
  expect(keyToPtyBytes({ name: "a", sequence: "a" })).toBe("a");
  // unicode
  expect(keyToPtyBytes({ name: "a", sequence: "é" })).toBe("é");

  // enter
  expect(keyToPtyBytes({ name: "enter" })).toBe("\r");
  // backspace
  expect(keyToPtyBytes({ name: "backspace" })).toBe("\x7f");
  // ctrl-c -> \x03
  expect(keyToPtyBytes({ name: "c", ctrl: true })).toBe("\x03");

  // arrows via csi
  expect(keyToPtyBytes({ name: "up" })).toBe("\x1b[A");
  expect(keyToPtyBytes({ name: "down", ctrl: true })).toBe("\x1b[1;5B");

  // home/end via csi
  expect(keyToPtyBytes({ name: "home" })).toBe("\x1b[H");
  expect(keyToPtyBytes({ name: "end" })).toBe("\x1b[F");

  // modifiers shift in arrow
  expect(keyToPtyBytes({ name: "left", shift: true })).toContain(";2");

  // app-cursor: when applicationCursorKeys and no mods, should be SS3 not CSI for arrows
  expect(keyToPtyBytes({ name: "up" }, { applicationCursorKeys: true })).toBe("\x1bOA");
  // with ctrl, falls back to CSI
  expect(keyToPtyBytes({ name: "up", ctrl: true }, { applicationCursorKeys: true })).toBe("\x1b[1;5A");
});

test("T12 NC shape: keys.ts has exactly one modifier computation in csi()", async () => {
  const src = await Bun.file("packages/tui/src/taudesk/pty/keys.ts").text();
  // Count occurrences of "mod = 1 +" or "mod=1+" — our canonical calc
  const matches = src.match(/mod\s*=\s*1\s*\+/g) ?? [];
  expect(matches.length).toBe(1);
  // And ensure meta excluded — csi signature should NOT include meta
  expect(src).not.toMatch(/csi\(.*meta/);
});
