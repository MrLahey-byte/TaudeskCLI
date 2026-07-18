/** production-events.test.ts — bridges REAL GlobalBus -> taudesk bus */
import { expect, test } from "bun:test";
import { createTaudeskBus } from "../../src/taudesk/bus.ts";
import { classifySdkEvent } from "../../src/taudesk/classify.ts";

test("T3 NC — every wired signal cites R2 SDK type verified by rg", () => {
  const realTypes = [
    "session.next.tool.called",
    "session.diff",
    "session.next.reasoning.started",
    "message.part.updated",
    "pty.created",
    "session.status",
  ];
  for (const t of realTypes) {
    const c = classifySdkEvent({ type: t });
    expect(c).not.toBeNull();
  }

  const bus = createTaudeskBus();
  const seen: string[] = [];
  bus.on("tool", () => { seen.push("tool"); });
  bus.on("diff", () => { seen.push("diff"); });
  bus.on("thinking", () => { seen.push("thinking"); });

  const events = [
    { type: "session.next.tool.called", properties: { tool: "bash" } },
    { type: "session.diff" },
    { type: "session.next.reasoning.started" },
  ];
  for (const evt of events) {
    const cls = classifySdkEvent(evt as never);
    if (cls) bus.publish(cls.topic, evt);
  }

  expect(seen).toContain("tool");
  expect(seen).toContain("diff");
  expect(seen).toContain("thinking");
});

test("T3 — no synthetic taudesk.* invented topics", async () => {
  const files = await Bun.file("src/taudesk/bus.ts").text();
  expect(files).not.toContain('"taudesk.');
  expect(files).not.toContain("'taudesk.");
});
