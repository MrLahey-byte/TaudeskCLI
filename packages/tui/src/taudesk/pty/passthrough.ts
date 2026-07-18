// pty/passthrough.ts — pure passthrough decision. Deps injected.
// Pane-switch combo returns false so priority wins (G14).

export type PassthroughDeps = {
  isPaneSwitchCombo: (key: { name?: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean; sequence?: string }) => boolean;
  writeToPty: (bytes: string) => void;
};

export type KeyInput = {
  name?: string;
  sequence?: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
};

export function handleKeyPassthrough(key: KeyInput, deps: PassthroughDeps): boolean {
  // If pane-switch combo, do NOT consume — let priority handler win
  if (deps.isPaneSwitchCombo(key)) {
    return false;
  }
  // Otherwise write to PTY if we have bytes
  // Printable/unicode path — caller already has bytes via keys.ts; we just delegate to deps.writeToPty
  // For pure layer, we signal consumed=true if write happened; actual byte conversion elsewhere.
  // Here we assume deps.writeToPty is called by caller after keyToPtyBytes; this function just enforces early-return.
  return true;
}

export function shouldConsumeForPty(
  key: KeyInput,
  deps: { isPaneSwitchCombo: (k: KeyInput) => boolean; toBytes: (k: KeyInput) => string | undefined; write: (b: string) => void },
): boolean {
  if (deps.isPaneSwitchCombo(key)) return false;
  const bytes = deps.toBytes(key);
  if (bytes === undefined) return false;
  deps.write(bytes);
  return true;
}
