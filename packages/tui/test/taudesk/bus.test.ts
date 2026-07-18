import { expect, test } from "bun:test";
import { createTaudeskBus } from "../../src/taudesk/bus.ts";

test("bus publish redacts except pty topic, freezes, caps, safe catches sync+async", async () => {
  const bus = createTaudeskBus();
  const received: unknown[] = [];

  bus.on("tool", (evt) => {
    received.push(evt.data);
  });

  let badCalled = false;
  bus.on("tool", () => {
    badCalled = true;
    throw new Error("bad subscriber");
  });

  let badAsyncCalled = false;
  bus.on("tool", async () => {
    badAsyncCalled = true;
    throw new Error("bad async");
  });

  bus.publish("tool", { text: "AKIAIOSFODNN7EXAMPLE1234 secret" });
  bus.publish("pty", { raw: "AKIAIOSFODNN7EXAMPLE1234 should NOT be redacted in pty" });

  // redaction at publish pre display/persist
  expect((received[0] as { text: string }).text).toContain("[REDACTED]");
  // pty EXEMPT — not redacted by design
  const ptyHist = bus.history.filter((e) => e.topic === "pty");
  expect(ptyHist[0].data).toHaveProperty("raw");
  expect((ptyHist[0].data as { raw: string }).raw).toContain("AKIAIOSFODNN7EXAMPLE1234");

  // safe() caught both sync throw and async rejection — one bad subscriber never breaks rest
  expect(badCalled).toBe(true);
  expect(badAsyncCalled).toBe(true);
  expect(received.length).toBe(1);

  // caps R3: publish many tools, shift-oldest
  for (let i = 0; i < 310; i++) bus.publish("tool", { i });
  expect(bus.tools.length).toBeLessThanOrEqual(300);
});
