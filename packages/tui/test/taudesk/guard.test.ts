import { expect, test } from "bun:test";

test("guard installs idempotent via globalThis flag", async () => {
  const { installProcessGuard } = await import("../../src/taudesk/guard.ts");
  // Reset flag for test
  (globalThis as any).__taudesk_guard_installed__ = undefined;

  let publishCalled = false;
  const bus = { publish: () => { publishCalled = true; } };

  installProcessGuard(bus as never);
  expect((globalThis as any).__taudesk_guard_installed__).toBe(true);

  // second call no-op (idempotent)
  installProcessGuard(bus as never);
  expect((globalThis as any).__taudesk_guard_installed__).toBe(true);

  // cleanup flag for other tests
  (globalThis as any).__taudesk_guard_installed__ = undefined;
});
