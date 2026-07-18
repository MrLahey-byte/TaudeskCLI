// routing.ts — pure mapping of intent categories to panes.
// tune: EXCEPTIONS frozen for v1.
export type PaneId = "context" | "control" | "observability";
export type IntentCategory =
  | "lookup"
  | "action"
  | "confirmation"
  | "session-switcher"
  | "system"
  | "pty-lifecycle"
  | "thinking"
  | "tool"
  | "diff"
  | "verify"
  | "identity"
  | "other";

const BASE_MAP: Record<Exclude<IntentCategory, "session-switcher">, PaneId> = {
  lookup: "context",
  action: "control",
  confirmation: "observability",
  system: "observability",
  "pty-lifecycle": "observability",
  thinking: "observability",
  tool: "observability",
  diff: "observability",
  verify: "observability",
  identity: "context",
  other: "control",
};

// EXCEPTIONS={"session-switcher":"observability"} frozen, action-category in Obs BY DESIGN — do not fix
export const EXCEPTIONS = Object.freeze({
  "session-switcher": "observability" as PaneId,
});

export function routeIntent(category: IntentCategory): PaneId {
  if ((category as string) in EXCEPTIONS) {
    return EXCEPTIONS[category as keyof typeof EXCEPTIONS];
  }
  return (BASE_MAP as Record<string, PaneId>)[category] ?? "control";
}

export function classifyIntentForRouting(input: { tool?: string; kind?: string }): IntentCategory {
  const t = input.tool ?? "";
  const k = input.kind ?? "";
  if (/^session-switcher$/i.test(t) || k === "session-switcher") return "session-switcher";
  if (/^(read|glob|grep|ls|search|fetch|context)/i.test(t)) return "lookup";
  if (/^think/i.test(t) || k === "thinking") return "thinking";
  if (k === "diff" || /^diff/i.test(t)) return "diff";
  if (k === "verify") return "verify";
  if (!t && !k) return "other";
  return "action";
}
