// guard.ts — process-wide error guards. I/O allowlist owns process guards.
// Why narrow uncaughtException: only ERR_SOCKET_CLOSED + "node-pty" in stack degrades terminal tabs (ConPTY unreliability documented in pty/DECISION.md).
// All else fails fast exit(1) — never swallow unrelated bugs per §3 guard.ts

const FLAG = "__taudesk_guard_installed__";

export type GuardBus = {
  publish: (topic: string, data: unknown) => void;
};

type NodeProcess = {
  on: (event: "unhandledRejection" | "uncaughtException", handler: (err: unknown) => void) => void;
  exit: (code: number) => never;
};

function getNodeProcess(): NodeProcess | undefined {
  const maybeProcess = (globalThis as { process?: unknown }).process;
  if (!maybeProcess || typeof (maybeProcess as { on?: unknown }).on !== "function") return undefined;
  return maybeProcess as NodeProcess;
}

function isNodePtySocketClosed(error: unknown): boolean {
  const err = error as { code?: string; stack?: string; message?: string } | undefined;
  const code = err?.code ?? "";
  const stack = err?.stack ?? "";
  const message = err?.message ?? "";
  return code === "ERR_SOCKET_CLOSED" || (message.includes("ERR_SOCKET_CLOSED") && stack.toLowerCase().includes("node-pty"));
}

export function installProcessGuard(bus?: GuardBus): void {
  const globalWithFlag = globalThis as Record<string, unknown>;
  if (globalWithFlag[FLAG]) return;
  globalWithFlag[FLAG] = true;

  const proc = getNodeProcess();
  if (!proc) return;

  proc.on("unhandledRejection", (reason) => {
    // Keep alive per spec — unhandled rejection is logged not fatal for taudesk bus
    console.error("[taudesk] unhandledRejection", reason);
  });

  proc.on("uncaughtException", (error) => {
    if (isNodePtySocketClosed(error)) {
      console.error("[taudesk] PTY socket closed — degrading terminal tabs", error);
      bus?.publish("pty", { kind: "degraded", error: String(error).slice(0, 500) });
      return;
    }

    console.error("[taudesk] uncaughtException — exiting", error);
    try {
      proc.exit(1);
    } catch (exitError) {
      // Why swallow: exit may throw in test harnesses or when process already exiting — failure to exit is observable via log above
      console.error("[taudesk] exit failed", exitError);
    }
  });
}
