import { expect, test } from "bun:test";
import { parseTaudeskConfig, loadTaudeskConfig, DEFAULT_CONFIG } from "../../src/taudesk/config.ts";

test("parse invalid -> DEFAULT", () => {
  const cfg = parseTaudeskConfig(null);
  expect(cfg.keybinds.pane_switch).toBe(DEFAULT_CONFIG.keybinds.pane_switch);
});

test("parse valid name and reject traversal", () => {
  const cfg = parseTaudeskConfig({
    keybinds: { pane_switch: "ctrl+shift+] " },
    verify: { commands: [{ name: "my-cmd", command: "echo hi", cwd: "../escape" }] },
    contextMode: "pinned",
  });
  expect(cfg.keybinds.pane_switch).toBe("ctrl+shift+]");
  expect(cfg.verify.commands.length).toBe(0); // traversal rejected
  expect(cfg.contextMode).toBe("pinned");
});

test("reject absolute cwd", () => {
  const cfg = parseTaudeskConfig({
    verify: { commands: [{ name: "ok", command: "echo", cwd: "/etc" }] },
  });
  expect(cfg.verify.commands.length).toBe(0);
});

test("name regex valid", () => {
  const cfg = parseTaudeskConfig({
    verify: { commands: [{ name: "good-name_1.test", command: "echo" }, { name: " bad", command: "x" }] },
  });
  expect(cfg.verify.commands.length).toBe(1);
  expect(cfg.verify.commands[0].name).toBe("good-name_1.test");
});

test("loadTaudeskConfig precedence root-most < nearest, taudesk.json < .taudesk.json within dir", async () => {
  // in-mem FS
  const files = new Map<string, string>();
  files.set("/root/taudesk.json", JSON.stringify({ keybinds: { pane_switch: "ctrl+a" }, contextMode: "hidden" }));
  files.set("/root/sub/.taudesk.json", JSON.stringify({ keybinds: { pane_switch: "ctrl+b" } }));
  files.set("/root/sub/nested/taudesk.json", JSON.stringify({ keybinds: { terminal_toggle: "ctrl+z" } }));
  files.set("/root/sub/nested/.taudesk.json", JSON.stringify({ keybinds: { terminal_toggle: "ctrl+y" } })); // should win over taudesk.json in same dir

  const io = {
    exists: (p: string) => files.has(p),
    read: (p: string) => files.get(p)!,
    dirname: (p: string) => {
      const idx = p.lastIndexOf("/");
      if (idx <= 0) return "/";
      return p.slice(0, idx);
    },
    join: (...parts: string[]) => parts.join("/").replace(/\/+/g, "/"),
  };

  const cfg = await loadTaudeskConfig("/root/sub/nested", io as never);
  // .taudesk.json in nested = ctrl+y should win within dir
  expect(cfg.keybinds.terminal_toggle).toBe("ctrl+y");
  // pane_switch from middle dir .taudesk.json = ctrl+b (nearest that sets it)
  expect(cfg.keybinds.pane_switch).toBe("ctrl+b");
  // contextMode from root should still be hidden (not overridden by nearer)
  expect(cfg.contextMode).toBe("hidden");
});
