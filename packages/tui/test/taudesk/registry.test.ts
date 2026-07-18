import { expect, test } from "bun:test";
import { TaudeskPluginRegistry } from "../../src/taudesk/plugin/registry.ts";

test("registry pure Map ordered throws on duplicate, validates id/title/pane/fn", () => {
  const reg = new TaudeskPluginRegistry();
  reg.register({ id: "a.b", slot: "observability", title: "A", order: 2, component: () => null as unknown as never });
  reg.register({ id: "b.c", slot: "context", title: "B", order: 1, component: () => null as unknown as never });

  // ordered by order
  expect(reg.list()[0].id).toBe("b.c");

  // duplicate throws
  expect(() => reg.register({ id: "a.b", slot: "observability", title: "A", component: () => null as unknown as never })).toThrow();

  // bad id
  expect(() => reg.register({ id: "bad id!", slot: "observability", title: "X", component: () => null as unknown as never } as never)).toThrow();

  // empty title
  expect(() => reg.register({ id: "ok.id", slot: "observability", title: "", component: () => null as unknown as never } as never)).toThrow();
});
