import { expect, test } from "bun:test";
import { readVisibleLines, readVisibleLinesFromStrings } from "../../src/taudesk/pty/read-buffer.ts";

test("readVisibleLines pure viewport read", () => {
  const lines = [
    [{ char: "a" }, { char: "b" }],
    [{ char: "c" }],
    [{ char: "d" }, { char: "e" }, { char: "f" }],
  ];
  expect(readVisibleLines(lines as never, { top: 0, height: 2 })).toEqual(["ab", "c"]);
  expect(readVisibleLines(lines as never, { top: 1, height: 1 })).toEqual(["c"]);
});

test("readVisibleLinesFromStrings", () => {
  const buf = ["line0", "line1", "line2", "line3"];
  expect(readVisibleLinesFromStrings(buf, { top: 1, height: 2 })).toEqual(["line1", "line2"]);
});
