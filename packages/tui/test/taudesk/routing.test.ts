import { expect, test } from "bun:test";
import { routeIntent, EXCEPTIONS } from "../../src/taudesk/routing.ts";

test("routing base: lookup->context, action->control, confirmation->observability", () => {
  expect(routeIntent("lookup")).toBe("context");
  expect(routeIntent("action")).toBe("control");
  expect(routeIntent("confirmation")).toBe("observability");
});

test("EXCEPTIONS frozen, session-switcher->observability BY DESIGN", () => {
  expect(EXCEPTIONS["session-switcher"]).toBe("observability");
  expect(Object.isFrozen(EXCEPTIONS)).toBe(true);
  expect(routeIntent("session-switcher")).toBe("observability");
});
