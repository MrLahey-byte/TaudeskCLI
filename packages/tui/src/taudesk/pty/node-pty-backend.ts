// pty/node-pty-backend.ts — @lydell/node-pty wrapper, lazily imported.
// Documents ConPTY unreliability: drops writes under ConPTY with ERR_SOCKET_CLOSED (B5).

export type NodePtyProc = {
  pid: number;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (e: { exitCode: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
};

let cached: { spawn: (shell: string, args: string[], opts: unknown) => NodePtyProc } | null = null;

export async function getNodePtyBackend(): Promise<{ spawn: (shell: string, args: string[], opts: unknown) => NodePtyProc } | null> {
  if (cached) return cached;
  try {
    const mod = await import("node-pty");
    // @ts-ignore
    const spawn = mod.spawn ?? mod.default?.spawn;
    if (!spawn) return null;
    cached = { spawn };
    return cached;
  } catch {
    return null;
  }
}

export function buildShellEnv(extra: { cols: number; rows: number }): Record<string, string> {
  return {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    LC_ALL: "C.UTF-8",
    OPENCODE_TERMINAL: "1",
    COLUMNS: String(extra.cols),
    LINES: String(extra.rows),
  };
}
