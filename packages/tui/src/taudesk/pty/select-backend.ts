// pty/select-backend.ts — pure backend selection.
// tune: no knobs.
export type PtyBackendName = "node-pty" | "bun";

export function selectPtyBackendName(platform: string): PtyBackendName {
  return platform === "win32" ? "node-pty" : "bun";
}
