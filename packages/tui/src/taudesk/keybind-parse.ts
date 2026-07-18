// keybind-parse.ts — pure, no OpenTUI deps.
export type KeyModifier = "ctrl" | "shift" | "alt" | "meta";

export type ParsedKeyCombo = {
  name: string; // lowercased key name
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
};

const ALIAS: Record<string, KeyModifier> = {
  control: "ctrl",
  ctrl: "ctrl",
  option: "alt",
  alt: "alt",
  meta: "meta",
  cmd: "meta",
  super: "meta",
  win: "meta",
  shift: "shift",
};

function normalizeModifier(token: string): KeyModifier | undefined {
  return ALIAS[token.toLowerCase()];
}

export function parseKeyCombo(input: string): ParsedKeyCombo {
  const raw = input.trim();
  if (!raw) throw new Error("empty key combo");
  const parts = raw.toLowerCase().split("+").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error(`invalid combo: ${input}`);
  const mods: Record<KeyModifier, boolean> = { ctrl: false, shift: false, alt: false, meta: false };
  let name = "";
  for (const tok of parts) {
    const m = normalizeModifier(tok);
    if (m) {
      mods[m] = true;
    } else {
      // last non-mod token is the key name; allow keys with + (e.g. "ctrl++" not supported, must escape)
      name = tok;
    }
  }
  if (!name) {
    // maybe only modifiers? treat last as name if needed
    // e.g. for `+` key, user would write `ctrl+plus` — we don't support raw `+`
    throw new Error(`missing key name in combo: ${input}`);
  }
  // handle single-char names that were split ambiguity: input like `ctrl+shift+]` -> last tok is `]`
  return { name, ctrl: mods.ctrl, shift: mods.shift, alt: mods.alt, meta: mods.meta };
}

export function matchesKeyCombo(parsed: ParsedKeyCombo, event: { name: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }): boolean {
  // compare ALL FOUR modifiers + name (fabletau bug if only ctrl compared)
  return (
    parsed.name === event.name.toLowerCase() &&
    parsed.ctrl === !!event.ctrl &&
    parsed.shift === !!event.shift &&
    parsed.alt === !!event.alt &&
    parsed.meta === !!event.meta
  );
}

export function normalizeKeyComboString(input: string): string {
  // normalized case/space/order per R4 spec
  const p = parseKeyCombo(input);
  const mods: string[] = [];
  if (p.ctrl) mods.push("ctrl");
  if (p.shift) mods.push("shift");
  if (p.alt) mods.push("alt");
  if (p.meta) mods.push("meta");
  mods.sort();
  return [...mods, p.name].join("+");
}
