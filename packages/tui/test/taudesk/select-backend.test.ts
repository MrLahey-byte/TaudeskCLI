import { expect, test } from "bun:test";
import { selectPtyBackendName } from "../../src/taudesk/pty/select-backend.ts";

test("selectPtyBackendName: win32 -> node-pty else bun", () => {
  expect(selectPtyBackendName("win32")).toBe("node-pty");
  expect(selectPtyBackendName("linux")).toBe("bun");
  expect(selectPtyBackendName("darwin")).toBe("bun");
});
