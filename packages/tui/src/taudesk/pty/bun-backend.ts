// pty/bun-backend.ts — bun-pty wrapper. Lazy-loaded per B5.
// I/O allowlist: owns process.

export type BunPtyBackend = {
  spawn: (opts: { cols: number; rows: number; cwd?: string; shell?: string; env?: Record<string, string> }) => BunPtyProc;
};

export type BunPtyProc = {
  pid: number;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (code: number) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
};

let cached: BunPtyBackend | null = null;

export async function getBunPtyBackend(): Promise<BunPtyBackend | null> {
  if (cached) return cached;
  try {
    // bun-pty 0.4.8 — lazy import
    const mod = await import("bun-pty");
    // @ts-ignore
    const spawnFn = mod.spawn ?? mod.default?.spawn ?? mod.Terminal?.spawn;
    if (!spawnFn) return null;
    cached = {
      spawn: (opts) => {
        // wrap unknown shape
        const proc = spawnFn({
          cols: opts.cols,
          rows: opts.rows,
          cwd: opts.cwd,
          shell: opts.shell,
          env: opts.env,
        }) as {
          pid: number;
          onData: (cb: (d: string) => void) => void;
          onExit: (cb: (c: number) => void) => void;
          write: (s: string) => void;
          resize: (cols: number, rows: number) => void;
          kill: () => void;
        };
        return proc as BunPtyProc;
      },
    };
    return cached;
  } catch {
    return null;
  }
}
