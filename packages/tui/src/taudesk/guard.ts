// guard.ts — process-wide error guards. I/O allowlist: owns process guards.
// NARROW uncaughtException handling: only ERR_SOCKET_CLOSED + "node-pty" in stack degrades terminal tabs.
// All else logs + exit(1). Idempotent via globalThis flag.

const FLAG = "__taudesk_guard_installed__";

export type GuardBus = {
  publish: (topic: string, data: unknown) => void;
};

export function installProcessGuard(bus?: GuardBus): void {
  const g = globalThis as Record<string, unknown>;
  if (g[FLAG]) return;
  g[FLAG] = true;

  const proc = (globalThis as unknown as { process?: NodeJS.Process }).process;
  if (!proc) return;

  proc.on("unhandledRejection", (reason) => {
    console.error("[taudesk] unhandledRejection", reason);
    // keep alive per spec
  });

  proc.on("uncaughtException", (err: unknown) => {
    const e = err as { code?: string; stack?: string; message?: string } | undefined;
    const code = e?.code ?? "";
    const stack = e?.stack ?? "";
    const msg = e?.message ?? "";

    const isNodePtySocketClosed =
      code === "ERR_SOCKET_CLOSED" ||
      (msg.includes("ERR_SOCKET_CLOSED") && stack.toLowerCase().includes("node-pty"));

    if (isNodePtySocketClosed) {
      console.error("[taudesk] PTY socket closed — degrading terminal tabs", err);
      bus?.publish("pty", { kind: "degraded", error: String(err).slice(0, 500) });
      return;
    }

    console.error("[taudesk] uncaughtException — exiting", err);
    try {
      proc.exit(1);
    } catch {
      // ignore
    }
  });
}
