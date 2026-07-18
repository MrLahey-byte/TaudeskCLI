// pty/keys.ts — pure key -> PTY bytes table. ONE modifier calc inside csi() per R8/T12.
export type PtyKeyModifiers = { shift?: boolean; alt?: boolean; ctrl?: boolean; meta?: boolean };

export type KeyInput = {
  name?: string; // e.g. "a", "enter", "backspace", "up", "f1"
  sequence?: string; // printable
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  code?: string;
};

// R8 — the only modifier calc (T12 NC: grep exactly one computation)
export function csi(final: string, opts: { shift?: boolean; alt?: boolean; ctrl?: boolean }): string {
  const mod = 1 + (opts.shift ? 1 : 0) + (opts.alt ? 2 : 0) + (opts.ctrl ? 4 : 0);
  return mod === 1 ? `\x1b[${final}` : `\x1b[1;${mod}${final}`;
}

function ctrlLetter(ch: string): string {
  const lower = ch.toLowerCase();
  const code = lower.charCodeAt(0) - 96;
  return String.fromCharCode(code);
}

export function keyToPtyBytes(
  key: KeyInput,
  opts?: { applicationCursorKeys?: boolean },
): string | undefined {
  const name = (key.name ?? "").toLowerCase();
  const seq = key.sequence ?? "";

  // C0 controls
  if (key.ctrl) {
    if (name === "c") return "\x03";
    if (name === "d") return "\x04";
    if (name === "z" && !key.shift) return "\x1a";
    // ctrl+letter generic
    if (name.length === 1 && /^[a-z]$/.test(name)) {
      return ctrlLetter(name);
    }
  }

  // Special keys
  if (name === "enter" || name === "return") return "\r";
  if (name === "backspace") return "\x7f";
  if (name === "tab" && !key.shift) return "\t";
  if (name === "tab" && key.shift) return "\x1b[Z";
  if (name === "escape") return "\x1b";

  // Arrow keys via csi() table (T12 — ONE calc)
  const mod = { shift: !!key.shift, alt: !!key.alt, ctrl: !!key.ctrl };
  const app = opts?.applicationCursorKeys;

  if (name === "up") return app ? (mod.ctrl || mod.alt || mod.shift ? csi("A", mod) : "\x1bOA") : csi("A", mod);
  if (name === "down") return app ? (mod.ctrl || mod.alt || mod.shift ? csi("B", mod) : "\x1bOB") : csi("B", mod);
  if (name === "right") return app ? (mod.ctrl || mod.alt || mod.shift ? csi("C", mod) : "\x1bOC") : csi("C", mod);
  if (name === "left") return app ? (mod.ctrl || mod.alt || mod.shift ? csi("D", mod) : "\x1bOD") : csi("D", mod);

  if (name === "home") return csi("H", mod);
  if (name === "end") return csi("F", mod);
  if (name === "pageup") return csi("5~", mod);
  if (name === "pagedown") return csi("6~", mod);
  if (name === "delete") return csi("3~", mod);
  if (name === "insert") return csi("2~", mod);

  // F1-F12
  const fMap: Record<string, string> = {
    f1: csi("11~", mod),
    f2: csi("12~", mod),
    f3: csi("13~", mod),
    f4: csi("14~", mod),
    f5: csi("15~", mod),
    f6: csi("17~", mod),
    f7: csi("18~", mod),
    f8: csi("19~", mod),
    f9: csi("20~", mod),
    f10: csi("21~", mod),
    f11: csi("23~", mod),
    f12: csi("24~", mod),
  };
  if (fMap[name]) return fMap[name];

  // Printable / unicode pass-through
  if (seq && seq.length > 0) {
    // If alt held, many terminals send ESC + char; keep simple: ESC prefix if alt
    if (key.alt && seq.length === 1) return `\x1b${seq}`;
    return seq;
  }

  // single char name fallback
  if (name.length === 1) return name;

  return undefined;
}
