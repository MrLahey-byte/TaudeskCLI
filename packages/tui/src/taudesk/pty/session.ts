// pty/session.ts — manager: publishes ONLY terminal.opened/exited on the bus. EPHEMERAL: no disk writes.
// SIGWINCH chain: pane resize -> renderable.onResize -> session.resize -> proc.resize.
import { selectPtyBackendName } from "./select-backend.ts";

export type PtySessionBus = { publish: (topic: string, data: unknown) => void };

export type PtySession = {
  id: string;
  pid: number;
  title: string;
  cols: number;
  rows: number;
  status: "running" | "exited";
  exitCode?: number;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (cb: (data: string) => void) => () => void;
};

let idCounter = 0;
export function createPtySessionId(): string {
  return `pty_${++idCounter}_${Date.now()}`;
}

export async function createPtySession(
  opts: {
    cols: number;
    rows: number;
    cwd?: string;
    shell?: string;
    env?: Record<string, string>;
    platform?: string;
    bus?: PtySessionBus;
  },
  backendLoader: {
    getBun: () => Promise<any>;
    getNodePty: () => Promise<any>;
  } = {
    getBun: async () => {
      const m: any = await import("./bun-backend.ts");
      return m.getBunPtyBackend();
    },
    getNodePty: async () => {
      const m: any = await import("./node-pty-backend.ts");
      return m.getNodePtyBackend();
    },
  },
): Promise<PtySession> {
  const platform = opts.platform ?? (typeof process !== "undefined" ? (process as any).platform : "linux");
  const backendName = selectPtyBackendName(platform as any);
  const cols = opts.cols;
  const rows = opts.rows;
  const cwd = opts.cwd ?? (typeof process !== "undefined" ? (process as any).cwd?.() : undefined);
  const envBase: Record<string, string> = {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    LC_ALL: "C.UTF-8",
    OPENCODE_TERMINAL: "1",
    COLUMNS: String(cols),
    LINES: String(rows),
    ...(opts.env ?? {}),
  };

  let shell = opts.shell;
  if (!shell) {
    if (platform === "win32") {
      try {
        const which = (globalThis as any).Bun?.which;
        shell = which ? (which("pwsh") ?? which("powershell") ?? "cmd.exe") : "cmd.exe";
      } catch { shell = "cmd.exe"; }
    } else {
      shell = (typeof process !== "undefined" ? (process as any).env?.SHELL : undefined) ?? "/bin/sh";
    }
  }

  const id = createPtySessionId();
  const dataCbs = new Set<(d: string) => void>();
  let status: "running" | "exited" = "running";
  let exitCode: number | undefined = undefined;
  let procPid = 0;
  let writeFn: (d: string) => void = () => {};
  let resizeFn: (c: number, r: number) => void = () => {};
  let killFn: () => void = () => {};

  const publishOpened = () => opts.bus?.publish("pty", { kind: "opened", id, pid: procPid, title: shell, cols, rows });
  const publishExited = (code: number) => {
    status = "exited";
    exitCode = code;
    opts.bus?.publish("pty", { kind: "exited", id, exitCode: code });
  };

  if (backendName === "node-pty") {
    const backend = await backendLoader.getNodePty();
    if (!backend) throw new Error("node-pty backend unavailable");
    const proc: any = backend.spawn(shell!, [], { name: "xterm-256color", cols, rows, cwd, env: envBase });
    procPid = proc.pid;
    proc.onData((data: any) => { for (const cb of dataCbs) cb(data); });
    proc.onExit((e: any) => { publishExited(e.exitCode ?? e.code ?? 0); });
    writeFn = proc.write.bind(proc);
    resizeFn = proc.resize.bind(proc);
    killFn = () => { try { proc.kill(); } catch {} };
  } else {
    const backend = await backendLoader.getBun();
    if (!backend) throw new Error("bun-pty backend unavailable");
    // bun-pty 0.4.8 signature: spawn(shell, args, opts) OR spawn(opts) — try robustly
    let proc: any;
    try {
      proc = backend.spawn(shell!, [], { cols, rows, cwd, env: envBase } as any);
    } catch {
      try {
        proc = backend.spawn({ cols, rows, cwd, shell, env: envBase });
      } catch {
        proc = backend.spawn(shell!, [], { cols, rows, cwd, env: envBase });
      }
    }
    // The proc may have onData/onExit with different names; normalize
    procPid = proc.pid ?? 0;
    if (proc.onData) proc.onData((data: any) => { for (const cb of dataCbs) cb(String(data)); });
    else if (proc.on) proc.on("data", (data: any) => { for (const cb of dataCbs) cb(String(data)); });

    if (proc.onExit) proc.onExit((code: any) => { const c = typeof code === "number" ? code : (code?.exitCode ?? 0); publishExited(c); });
    else if (proc.on) proc.on("exit", (e: any) => { publishExited(e?.exitCode ?? 0); });

    writeFn = (d: string) => { try { proc.write(d); } catch {} };
    resizeFn = (c: number, r: number) => { try { proc.resize(c, r); } catch {} };
    killFn = () => { try { proc.kill(); } catch {} };
  }

  publishOpened();
  return {
    get id() { return id; },
    get pid() { return procPid; },
    get title() { return shell ?? "pty"; },
    get cols() { return cols; },
    get rows() { return rows; },
    get status() { return status; },
    get exitCode() { return exitCode; },
    write: (d: string) => writeFn(d),
    resize: (c, r) => resizeFn(c, r),
    kill: () => killFn(),
    onData: (cb) => { dataCbs.add(cb); return () => dataCbs.delete(cb); },
  };
}
