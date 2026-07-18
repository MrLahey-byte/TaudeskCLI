// pty/bun-backend.ts — bun-pty wrapper, lazily imported per B5.
// Why lazy: non-PTY users never load native binding (perf budget).

type BunPtySpawnOptions = {
  cols: number;
  rows: number;
  cwd?: string;
  shell?: string;
  env?: Record<string, string>;
};

type BunPtyModuleShape = {
  spawn?: (opts: BunPtySpawnOptions) => unknown;
  default?: { spawn?: (opts: BunPtySpawnOptions) => unknown; Terminal?: { spawn?: (opts: BunPtySpawnOptions) => unknown } } & ((opts: BunPtySpawnOptions) => unknown);
  Terminal?: { spawn?: (opts: BunPtySpawnOptions) => unknown };
};

export type BunPtyBackend = {
  spawn: (opts: BunPtySpawnOptions) => unknown;
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
    const moduleShape = (await import("bun-pty")) as BunPtyModuleShape;
    const spawnFn =
      moduleShape.spawn ?? moduleShape.default?.spawn ?? (moduleShape.default as unknown as (opts: BunPtySpawnOptions) => unknown) ?? moduleShape.Terminal?.spawn;
    if (!spawnFn) return null;
    cached = {
      spawn: (opts) => (spawnFn as (opts: BunPtySpawnOptions) => unknown)(opts),
    };
    return cached;
  } catch {
    return null;
  }
}
