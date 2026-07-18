import { expect, test } from "bun:test";
import { classifySdkEvent } from "../../src/taudesk/classify.ts";

test("classify covers R2 types: tool called, diff, reasoning, pty, message.part.updated carrying tool/reasoning", () => {
  expect(classifySdkEvent({ type: "session.next.tool.called" })?.topic).toBe("tool");
  expect(classifySdkEvent({ type: "session.diff" })?.topic).toBe("diff");
  expect(classifySdkEvent({ type: "session.next.reasoning.started" })?.topic).toBe("thinking");
  expect(classifySdkEvent({ type: "pty.created" })?.topic).toBe("pty");

  // v1 shape message.part.updated carrying tool
  const toolPart = classifySdkEvent({ type: "message.part.updated", properties: { part: { type: "tool" } } } as never);
  expect(toolPart?.topic).toBe("tool");

  const reasoningPart = classifySdkEvent({ type: "message.part.updated", properties: { part: { type: "reasoning" } } } as never);
  expect(reasoningPart?.topic).toBe("thinking");
});
