// classify.ts — pure SDK event → {topic, kind}. Uses only R2 types verified by rg.
// Functional core: no bus/OpenTUI deps.

export type Classified = {
  topic: string;
  kind: string;
  rawType: string;
};

export function classifySdkEvent(event: { type: string; properties?: unknown }): Classified | null {
  const t = event.type;

  // R2 verified types
  if (t === "session.next.tool.called") return { topic: "tool", kind: "called", rawType: t };
  if (t === "session.next.tool.success") return { topic: "tool", kind: "success", rawType: t };
  if (t === "session.next.tool.failed" || t === "session.next.tool.failure") return { topic: "tool", kind: "failed", rawType: t };
  if (t === "session.diff") return { topic: "diff", kind: "updated", rawType: t };
  if (t === "session.status") return { topic: "session", kind: "status", rawType: t };
  if (t === "session.idle") return { topic: "session", kind: "idle", rawType: t };
  if (t === "session.next.model.switched") return { topic: "identity", kind: "model-switched", rawType: t };
  if (t === "session.next.agent.switched") return { topic: "identity", kind: "agent-switched", rawType: t };
  if (t === "message.part.updated") {
    // v1 shape carrying tool/reasoning parts — need to inspect part type if available
    const props = event.properties as { part?: { type?: string } } | undefined;
    const ptype = props?.part?.type;
    if (ptype === "tool") return { topic: "tool", kind: "part", rawType: t };
    if (ptype === "reasoning") return { topic: "thinking", kind: "delta", rawType: t };
    return { topic: "message", kind: "part-updated", rawType: t };
  }
  if (t === "message.updated") return { topic: "identity", kind: "message-updated", rawType: t };
  if (t === "session.next.reasoning.started") return { topic: "thinking", kind: "started", rawType: t };
  if (t === "session.next.reasoning.ended") return { topic: "thinking", kind: "ended", rawType: t };
  if (t === "session.next.reasoning.delta") return { topic: "thinking", kind: "delta", rawType: t };
  if (t === "session.next.context.updated") return { topic: "context", kind: "updated", rawType: t };
  if (t === "session.created") return { topic: "session", kind: "created", rawType: t };
  if (t === "session.updated") return { topic: "session", kind: "updated", rawType: t };
  if (t === "session.deleted") return { topic: "session", kind: "deleted", rawType: t };
  if (t === "session.next.step.started") return { topic: "session", kind: "step-started", rawType: t };
  if (t === "session.next.step.ended") return { topic: "session", kind: "step-ended", rawType: t };
  if (t === "pty.created") return { topic: "pty", kind: "created", rawType: t };
  if (t === "pty.exited") return { topic: "pty", kind: "exited", rawType: t };
  // pty.* second form
  if (t.startsWith("pty.")) return { topic: "pty", kind: t.slice(4), rawType: t };
  return null;
}
