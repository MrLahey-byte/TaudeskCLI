import { expect, test } from "bun:test";
import { keyToPtyBytes, csi } from "../../src/taudesk/pty/keys.ts";

test("csi R8 — mod = 1+(shift)+(alt*2)+(ctrl*4), meta excluded", () => {
  expect(csi("A", {})).toBe("\x1b[A");
  expect(csi("A", { shift: true })).toBe("\x1b[1;2A");
  expect(csi("A", { alt: true })).toBe("\x1b[1;3A");
  expect(csi("A", { ctrl: true })).toBe("\x1b[1;5A");
  expect(csi("A", { shift: true, ctrl: true })).toBe("\x1b[1;6A");
});

test("keyToPtyBytes printable, unicode, enter/backspace/ctrl-c/arrows/home/end/modifiers/app-cursor", () => {
  expect(keyToPtyBytes({ name: "a", sequence: "a" })).toBe("a");
  expect(keyToPtyBytes({ name: "a", sequence: "é" })).toBe("é");
  expect(keyToPtyBytes({ name: "enter" })).toBe("\r");
  expect(keyToPtyBytes({ name: "backspace" })).toBe("\x7f");
  expect(keyToPtyBytes({ name: "c", ctrl: true })).toBe("\x03");
  expect(keyToPtyBytes({ name: "up" })).toBe("\x1b[A");
  expect(keyToPtyBytes({ name: "down", ctrl: true })).toBe("\x1b[1;5B");
  expect(keyToPtyBytes({ name: "home" })).toBe("\x1b[H");
  expect(keyToPtyBytes({ name: "end" })).toBe("\x1b[F");
  expect(keyToPtyBytes({ name: "left", shift: true })).toContain(";2");
  expect(keyToPtyBytes({ name: "up" }, { applicationCursorKeys: true })).toBe("\x1bOA");
  expect(keyToPtyBytes({ name: "up", ctrl: true }, { applicationCursorKeys: true })).toBe("\x1b[1;5A");
});

test("T12 NC shape: keys.ts has exactly one modifier computation in csi()", async () => {
  const src = await Bun.file("src/taudesk/pty/keys.ts").text();
  const matches = src.match(/mod\s*=\s*1\s*\+/g) ?? [];
  expect(matches.length).toBe(1);
  expect(src).not.toMatch(/csi\(.*meta/);
});
