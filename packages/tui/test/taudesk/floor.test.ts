import { expect, test } from "bun:test";
import { assessFloor } from "../../src/taudesk/floor.ts";

test("floor assessment: Tier1 100% KEEP required, unreachable=LOST=blocks release", () => {
  const report = assessFloor({
    multiProviderRouting: true,
    sessionPersistence: true,
    headlessCli: true,
    diffBeforeApply: true,
    pluginSystem: true,
  });
  expect(report.allKeep).toBe(true);
  expect(report.tier1.every((r) => r.verdict === "KEEP")).toBe(true);
});

test("floor LOST when any Tier1 missing", () => {
  const report = assessFloor({
    multiProviderRouting: false,
    sessionPersistence: true,
    headlessCli: true,
    diffBeforeApply: true,
    pluginSystem: true,
  });
  expect(report.allKeep).toBe(false);
  expect(report.tier1.find((r) => r.name.includes("multi-provider"))?.verdict).toBe("LOST");
});
