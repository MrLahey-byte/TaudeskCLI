// pty/bun-backend.ts — bun-pty wrapper, lazy-loaded per B5.
// Why lazy: non-PTY users never load native binding (perf budget per §4).

type BunPtySpawnOptions = {
  cols: number;
  rows: number;
  cwd?: string;
  shell?: string;
  env?: Record<string, string>;
};

type SpawnFn = (...args: unknown[]) => unknown;

type BunPtyModule = {
  spawn?: SpawnFn;
  default?: SpawnFn | { spawn?: SpawnFn; Terminal?: { spawn?: SpawnFn } };
  Terminal?: { spawn?: SpawnFn };
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

function extractSpawn(moduleShape: BunPtyModule): SpawnFn | null {
  if (typeof moduleShape.spawn === "function") return moduleShape.spawn;
  const def = moduleShape.default;
  if (!def) return moduleShape.Terminal?.spawn ?? null;
  if (typeof def === "function") return def as SpawnFn;
  return (def as { spawn?: SpawnFn }).spawn ?? def.Terminal?.spawn ?? moduleShape.Terminal?.spawn ?? null;
}

export async function getBunPtyBackend(): Promise<BunPtyBackend | null> {
  if (cached) return cached;
  try {
    const raw = (await import("bun-pty")) as unknown as BunPtyModule;
    const spawnFn = extractSpawn(raw);
    if (!spawnFn) return null;
    cached = {
      spawn: (opts) => (spawnFn as unknown as (opts: BunPtySpawnOptions) => unknown)(opts),
    };
    return cached;
  } catch {
    return null;
  }
}
