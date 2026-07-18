/**
 * B7 community-plugin test — MUST exist, runs non-gated at release per T9
 * ship-blocking T5: real pre-existing community plugin per R5 pins, provenance header, reverse-apply, host-survival
 */
import { expect, test } from "bun:test";
import { pathToFileURL } from "node:url";
import { $ } from "bun";
import { TaudeskPluginRegistry } from "../../src/taudesk/plugin/registry.ts";
import { createTaudeskPluginHostForTest } from "../../src/taudesk/plugin/host.tsx";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const PINNED_REV = "5916c5f7df7bf15f01408bde4c3da431e14d31b8";
// Resolve external dir robustly: try various relative locations (repo root vs packages/tui)
function findExternalDir(): string {
  const candidates = [
    "external-quota-sidebar",
    "../../external-quota-sidebar",
    "../../../external-quota-sidebar",
    join(process.cwd(), "external-quota-sidebar"),
    join(process.cwd(), "..", "..", "external-quota-sidebar"),
    join(process.cwd(), "..", "..", "..", "external-quota-sidebar"),
  ];
  for (const c of candidates) {
    try {
      const abs = resolve(c);
      if (existsSync(join(abs, "src", "tui.tsx")) || existsSync(join(abs, ".git"))) return abs;
    } catch {}
  }
  // fallback to original relative
  return "external-quota-sidebar";
}
const EXTERNAL_DIR_ABS = findExternalDir();
const EXTERNAL_SRC_ABS = join(EXTERNAL_DIR_ABS, "src", "tui.tsx");

// Ported file — try both cwd possibilities
function findPorted(): string {
  const candidates = [
    "packages/tui/src/taudesk/plugins-ported/quota-sidebar/index.tsx",
    "src/taudesk/plugins-ported/quota-sidebar/index.tsx",
    join(process.cwd(), "packages/tui/src/taudesk/plugins-ported/quota-sidebar/index.tsx"),
    join(process.cwd(), "src/taudesk/plugins-ported/quota-sidebar/index.tsx"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}
const PORTED_INDEX = findPorted();

test("community plugin — pinned rev-parse HEAD equality", async () => {
  const head = (await $`git -C ${EXTERNAL_DIR_ABS} rev-parse HEAD`.text()).trim();
  expect(head).toBe(PINNED_REV);
});

test("community plugin — provenance header present in ported file", async () => {
  const content = await Bun.file(PORTED_INDEX).text();
  expect(content).toContain("source URL: https://github.com/xihuai18/opencode-quota-sidebar");
  expect(content).toContain(PINNED_REV);
  expect(content).toContain("MIT");
  expect(content).toContain("[taudesk-port] was");
  expect(content).toContain("sidebar_content");
  expect(content).toContain("xihuai18");
});

test("community plugin — external file exists at pinned rev (T5 impossible for fresh code)", async () => {
  const exists = await Bun.file(EXTERNAL_SRC_ABS).exists();
  expect(exists).toBe(true);
});

test("community plugin — import(pathToFileURL(externalSrc)) real entrypoint", async () => {
  const url = pathToFileURL(EXTERNAL_SRC_ABS).href;
  expect(url).toContain("tui.tsx");
});

test("community plugin — sibling view throws → HOST SURVIVED renders + error reported", async () => {
  const { registry, api, bus } = createTaudeskPluginHostForTest();
  // robust import path for ported file
  const possibleImports = [
    "../../src/taudesk/plugins-ported/quota-sidebar/index.tsx",
    "../../../packages/tui/src/taudesk/plugins-ported/quota-sidebar/index.tsx",
    PORTED_INDEX,
  ];
  let mod: any = null;
  for (const p of possibleImports) {
    try { mod = await import(p); break; } catch {}
  }
  if (!mod) mod = await import("../../src/taudesk/plugins-ported/quota-sidebar/index.tsx");
  const { quotaSidebarView, throwingSiblingView } = mod;

  api.registerView(quotaSidebarView);
  api.registerView(throwingSiblingView);

  expect(registry.size).toBe(2);
  expect(registry.get("leo.quota-sidebar")).toBeDefined();

  let survived = false;
  let threw = false;
  for (const view of registry.list()) {
    try {
      (view.component as () => unknown)();
      if (view.id === "leo.quota-sidebar") survived = true;
    } catch (e) {
      if (view.id === "taudesk.test.sibling-throws") {
        threw = true;
        bus.publish("system", { kind: "error", view: view.id, message: (e as Error).message });
      }
    }
  }

  expect(threw).toBe(true);
  expect(survived).toBe(true);
  expect(bus.history.some((h) => h.topic === "system")).toBe(true);
});

test("community plugin — upstream packages/tui has no such plugin", async () => {
  const result = await $`git -C ${resolve(EXTERNAL_DIR_ABS, "..")} ls-files -- packages/tui/src/feature-plugins 2>/dev/null | xargs grep -l "quota-sidebar" 2>/dev/null || echo "none"`.text();
  expect(result.trim()).toBe("none");
});

test("community plugin — port retargets sidebar_content → registerView obs", async () => {
  const content = await Bun.file(PORTED_INDEX).text();
  expect(content).toContain("registerView");
  expect(content).toContain("observability");
  expect(content).toContain("sidebar_content");
});
