// pty/bun-backend.ts — bun-pty wrapper. Lazy-loaded per B5. Covers signatures seen in 0.4.8.

export type BunPtyBackend = {
  spawn: (opts: { cols: number; rows: number; cwd?: string; shell?: string; env?: Record<string, string> }) => any;
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
    const mod: any = await import("bun-pty");
    const spawnFn = mod.spawn ?? mod.default?.spawn ?? mod.default ?? mod.Terminal?.spawn;
    if (!spawnFn) return null;
    cached = { spawn: (opts: { cols: number; rows: number; cwd?: string; shell?: string; env?: Record<string, string> }) => spawnFn(opts) } as any;
    return cached;
  } catch {
    return null;
  }
}
