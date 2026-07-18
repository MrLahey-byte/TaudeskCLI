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
  // reject .. segments and absolute paths
  const normalized = p.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) return true;
  const parts = normalized.split("/");
  return parts.includes("..");
}

export function parseTaudeskConfig(input: unknown): TaudeskConfig {
  // Returns DEFAULT on error per spec; merge over DEFAULT
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
  } else if (Array.isArray((input as Record<string, unknown>).verify)) {
    // allow legacy shape? no — keep default
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
// within a dir taudesk.json < .taudesk.json. io injected. Init from process.cwd().
export async function loadTaudeskConfig(dir: string, io: ConfigIo): Promise<TaudeskConfig> {
  let current = dir;
  const configs: TaudeskConfig[] = [];
  const visited = new Set<string>();
  // naive walk up — stop at root (dirname==itself) or when .git found treated as git-root
  for (let i = 0; i < 64; i++) {
    if (visited.has(current)) break;
    visited.add(current);

    const candidates = [io.join(current, "taudesk.json"), io.join(current, ".taudesk.json")];
    for (const candidate of candidates) {
      try {
        const exists = await io.exists(candidate);
        if (!exists) continue;
        const raw = await io.read(candidate);
        const parsed = JSON.parse(raw);
        configs.push(parseTaudeskConfig(parsed));
      } catch {
        // invalid json => treat as DEFAULT (error case)
      }
    }

    // detect git root via .git existence — stop after processing it
    try {
      const gitMarker = io.join(current, ".git");
      if (await io.exists(gitMarker)) {
        break;
      }
    } catch {}

    const parent = io.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // configs collected from leaf to root; we need root-most first, then nearest overrides.
  configs.reverse();
  // Merge in order: defaults already in each parsed (which started from DEFAULT), so we merge sequentially
  let merged = structuredClone(DEFAULT_CONFIG);
  for (const cfg of configs) {
    // keybinds overwrite per key
    if (cfg.keybinds.pane_switch !== DEFAULT_CONFIG.keybinds.pane_switch) merged.keybinds.pane_switch = cfg.keybinds.pane_switch;
    if (cfg.keybinds.pane_switch_reverse !== DEFAULT_CONFIG.keybinds.pane_switch_reverse)
      merged.keybinds.pane_switch_reverse = cfg.keybinds.pane_switch_reverse;
    if (cfg.keybinds.terminal_toggle !== DEFAULT_CONFIG.keybinds.terminal_toggle)
      merged.keybinds.terminal_toggle = cfg.keybinds.terminal_toggle;
    // verify commands: replace entirely if present in file
    if (cfg.verify.commands.length > 0) {
      merged.verify.commands = cfg.verify.commands;
    }
    if (cfg.contextMode) merged.contextMode = cfg.contextMode;
  }
  return merged;
}
