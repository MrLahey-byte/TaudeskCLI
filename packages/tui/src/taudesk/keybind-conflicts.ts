// keybind-conflicts.ts — RESERVED table R4 + check.
export const RESERVED_COMBOS: Record<string, string> = {
  "alt+tab": "OS reserved — window switcher",
  "meta+tab": "darwin reserved — cmd+tab app switcher",
  "cmd+tab": "darwin reserved — app switcher (alias)",
  "meta+q": "darwin reserved — cmd+q quit",
  "cmd+q": "darwin reserved — quit (alias)",
  "alt+f4": "win32 reserved — close window",
  "ctrl+tab": "tabbed terminals reserved — win32/linux",
  "ctrl+shift+t": "browser/terminal reserved — reopen tab",
  "ctrl+shift+w": "reserved — close window/tab",
  "ctrl+w": "reserved — close",
};

export type Platform = "win32" | "linux" | "darwin" | string;

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "").trim();
}

export function checkReservedConflict(combo: string, platform: Platform): string | undefined {
  const norm = normalize(combo);
  // direct match
  for (const [k, reason] of Object.entries(RESERVED_COMBOS)) {
    if (normalize(k) === norm) {
      // filter by platform for some entries
      if (k === "alt+f4" && platform !== "win32") continue;
      if ((k === "meta+tab" || k === "cmd+tab" || k === "meta+q" || k === "cmd+q") && platform !== "darwin") {
        // still treat as reserved on all? spec says RESERVED table includes platform notes
        // For defaults sanity we treat them as conflict only on matching platform
        // but to satisfy T11 NC we need defaults clean on every platform, so keep filtering.
        continue;
      }
      if (k === "ctrl+tab" && platform === "darwin") continue;
      return reason;
    }
  }
  return undefined;
}

// Defaults R4 — chosen reserved-clean on every platform (T11)
export const DEFAULT_KEYBINDS = {
  pane_switch: "ctrl+shift+]",
  pane_switch_reverse: "ctrl+shift+[",
  terminal_toggle: "ctrl+`",
} as const;

export const PRIORITIES = {
  PANE_SWITCH: 10000,
  PTY_PASSTHROUGH: 9000,
  WHICH_KEY: 900,
  SELECTION: 1,
} as const;
