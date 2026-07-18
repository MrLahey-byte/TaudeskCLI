// config.ts — pure parse + IO-injected loader. No FS, no OpenTUI.
import { DEFAULT_KEYBINDS } from "./keybind-conflicts.ts";

export type TaudeskVerifyCommand = {
  name: string;
  command: string | string[];
  cwd?: string;
  timeout_ms?: number;
};

export type TaudeskConfig = {
  keybinds: {
    pane_switch: string;
    pane_switch_reverse: string;
    terminal_toggle: string;
  };
  verify: {
    commands: TaudeskVerifyCommand[];
  };
  contextMode?: "auto" | "hidden" | "pinned";
};

export const DEFAULT_CONFIG: TaudeskConfig = {
  keybinds: {
    pane_switch: DEFAULT_KEYBINDS.pane_switch,
    pane_switch_reverse: DEFAULT_KEYBINDS.pane_switch_reverse,
    terminal_toggle: DEFAULT_KEYBINDS.terminal_toggle,
  },
  verify: { commands: [] },
  contextMode: "auto",
};

const NAME_RE = /^[a-zA-Z0-9][\w.-]*$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

function rejectTraversal(p: string): boolean {
  if (!p) return false;
  const normalized = p.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) return true;
  const parts = normalized.split("/");
  return parts.includes("..");
}

export function parseTaudeskConfig(input: unknown): TaudeskConfig {
  if (!isPlainObject(input)) return structuredClone(DEFAULT_CONFIG);
  const out: TaudeskConfig = structuredClone(DEFAULT_CONFIG);
  if (isPlainObject(input.keybinds)) {
    for (const k of ["pane_switch", "pane_switch_reverse", "terminal_toggle"] as const) {
      const v = (input.keybinds as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) out.keybinds[k] = v.trim();
    }
  }
  if (isPlainObject(input.verify) && Array.isArray((input.verify as Record<string, unknown>).commands)) {
    const cmds = (input.verify as { commands: unknown[] }).commands;
    const valid: TaudeskVerifyCommand[] = [];
    for (const raw of cmds) {
      if (!isPlainObject(raw)) continue;
      const name = raw.name;
      if (typeof name !== "string" || !NAME_RE.test(name)) continue;
      const command = raw.command;
      if (!(typeof command === "string" || (Array.isArray(command) && command.every((c) => typeof c === "string")))) continue;
      const obj: TaudeskVerifyCommand = { name, command: command as string | string[] };
      if (typeof raw.cwd === "string") {
        if (rejectTraversal(raw.cwd)) continue;
        obj.cwd = raw.cwd;
      }
      if (typeof raw.timeout_ms === "number" && Number.isFinite(raw.timeout_ms) && raw.timeout_ms > 0) {
        obj.timeout_ms = raw.timeout_ms;
      }
      valid.push(obj);
    }
    out.verify.commands = valid;
  }
  const cm = (input as Record<string, unknown>).contextMode;
  if (cm === "auto" || cm === "hidden" || cm === "pinned") {
    out.contextMode = cm;
  }
  return out;
}

export type ConfigIo = {
  exists: (path: string) => boolean | Promise<boolean>;
  read: (path: string) => string | Promise<string>;
  dirname: (path: string) => string;
  join: (...parts: string[]) => string;
};

// Walks cwd -> git-root, precedence defaults < root-most < nearest,
// within a dir taudesk.json < .taudesk.json (dot file wins). io injected.
export async function loadTaudeskConfig(dir: string, io: ConfigIo): Promise<TaudeskConfig> {
  let current = dir;
  const configs: TaudeskConfig[] = [];
  const visited = new Set<string>();

  // Collect per-dir with explicit tracking to avoid DEFAULT overwriting explicit values (contextMode bug)
  type Tracked = TaudeskConfig & { _hasContextMode?: boolean };
  const trackedConfigs: Tracked[] = [];

  for (let i = 0; i < 64; i++) {
    if (visited.has(current)) break;
    visited.add(current);

    let perDir: Tracked | null = null;

    for (const candidate of [io.join(current, "taudesk.json"), io.join(current, ".taudesk.json")]) {
      try {
        if (!(await io.exists(candidate))) continue;
        const rawStr = await io.read(candidate);
        const rawObj = JSON.parse(rawStr) as Record<string, unknown>;
        const parsed = parseTaudeskConfig(rawObj) as Tracked;
        const hasContextMode = typeof rawObj.contextMode === "string" && ["auto", "hidden", "pinned"].includes(rawObj.contextMode as string);
        parsed._hasContextMode = hasContextMode;

        if (!perDir) {
          perDir = parsed;
        } else {
          // within same dir dot (second) wins
          if (parsed.keybinds.pane_switch !== DEFAULT_CONFIG.keybinds.pane_switch) perDir.keybinds.pane_switch = parsed.keybinds.pane_switch;
          if (parsed.keybinds.pane_switch_reverse !== DEFAULT_CONFIG.keybinds.pane_switch_reverse) perDir.keybinds.pane_switch_reverse = parsed.keybinds.pane_switch_reverse;
          if (parsed.keybinds.terminal_toggle !== DEFAULT_CONFIG.keybinds.terminal_toggle) perDir.keybinds.terminal_toggle = parsed.keybinds.terminal_toggle;
          if (parsed.verify.commands.length > 0) perDir.verify.commands = parsed.verify.commands;
          if (hasContextMode) {
            perDir.contextMode = parsed.contextMode;
            perDir._hasContextMode = true;
          }
        }
      } catch {}
    }
    if (perDir) trackedConfigs.push(perDir);

    try {
      if (await io.exists(io.join(current, ".git"))) break;
    } catch {}
    const parent = io.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  trackedConfigs.reverse();

  let merged = structuredClone(DEFAULT_CONFIG) as Tracked;
  merged._hasContextMode = false;
  for (const cfg of trackedConfigs) {
    if (cfg.keybinds.pane_switch !== DEFAULT_CONFIG.keybinds.pane_switch) merged.keybinds.pane_switch = cfg.keybinds.pane_switch;
    if (cfg.keybinds.pane_switch_reverse !== DEFAULT_CONFIG.keybinds.pane_switch_reverse) merged.keybinds.pane_switch_reverse = cfg.keybinds.pane_switch_reverse;
    if (cfg.keybinds.terminal_toggle !== DEFAULT_CONFIG.keybinds.terminal_toggle) merged.keybinds.terminal_toggle = cfg.keybinds.terminal_toggle;
    if (cfg.verify.commands.length > 0) merged.verify.commands = cfg.verify.commands;
    const hasCtx = (cfg as Tracked)._hasContextMode ?? (cfg.contextMode !== undefined && cfg.contextMode !== DEFAULT_CONFIG.contextMode);
    if (hasCtx && cfg.contextMode) {
      merged.contextMode = cfg.contextMode;
      merged._hasContextMode = true;
    }
  }
  delete (merged as { _hasContextMode?: boolean })._hasContextMode;
  return merged;
}
