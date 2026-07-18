import { expect, test } from "bun:test";
import { isCheckoutClean, parseGitStatusPorcelain } from "../../src/taudesk/checkout/gate-pure.ts";

test("gate-pure: isCheckoutClean trim", () => {
  expect(isCheckoutClean("")).toBe(true);
  expect(isCheckoutClean("   \n")).toBe(true);
  expect(isCheckoutClean(" M file.ts")).toBe(false);
});

test("parseGitStatusPorcelain exit!=0 => non-git => clean", () => {
  const res = parseGitStatusPorcelain("", 128);
  expect(res.isGit).toBe(false);
  expect(res.dirty).toBe(false);
});

test("gate publishes refused and original NOT called", async () => {
  const { createGateWrapper } = await import("../../src/taudesk/gate.ts");
  let originalCalled = false;
  const original = async (input: { type: string }) => {
    originalCalled = true;
    return { ok: true };
  };
  const published: unknown[] = [];
  const io = {
    isRepo: () => true,
    gitStatusPorcelain: () => " M dirty.ts\n",
  };
  const wrapper = createGateWrapper({
    original,
    io,
    bus: { publish: (t, d) => published.push({ t, d }) },
    getIsTaskStart: (i) => i.type === "user-prompt",
  });

  const res = wrapper({ type: "user-prompt" });
  // Should be rejected promise pre-attached
  await expect(res).rejects.toThrow("dirty");
  expect(originalCalled).toBe(false);
  expect(published.some((p: any) => p.t === "checkout" && (p.d as any).kind === "refused")).toBe(true);

  // non-task-start should allow
  originalCalled = false;
  const res2 = await wrapper({ type: "nav" });
  expect(res2).toEqual({ ok: true });
  expect(originalCalled).toBe(true);
});
