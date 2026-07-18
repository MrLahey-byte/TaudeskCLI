// pty/session.ts — manager: publishes ONLY terminal.opened/exited on the bus. EPHEMERAL: no disk writes.
// SIGWINCH chain: pane resize -> renderable.onResize -> session.resize -> proc.resize.
// Shell: win32 Bun.which(pwsh)->powershell->cmd.exe else $SHELL||/bin/sh

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
    getBun: () => Promise<{ spawn: (o: { cols: number; rows: number; cwd?: string; shell?: string; env?: Record<string, string> }) => { pid: number; onData: (cb: (d: string) => void) => void; onExit: (cb: (c: number) => void) => void; write: (d: string) => void; resize: (c: number, r: number) => void; kill: () => void } } | null>;
    getNodePty: () => Promise<{ spawn: (shell: string, args: string[], o: unknown) => { pid: number; onData: (cb: (d: string) => void) => void; onExit: (cb: (e: { exitCode: number }) => void) => void; write: (d: string) => void; resize: (c: number, r: number) => void; kill: () => void } } | null>;
  } = {
    getBun: async () => {
      const m = await import("./bun-backend.ts");
      return m.getBunPtyBackend();
    },
    getNodePty: async () => {
      const m = await import("./node-pty-backend.ts");
      return m.getNodePtyBackend();
    },
  },
): Promise<PtySession> {
  const platform = opts.platform ?? (typeof process !== "undefined" ? process.platform : "linux");
  const backendName = selectPtyBackendName(platform);
  const cols = opts.cols;
  const rows = opts.rows;
  const cwd = opts.cwd ?? (typeof process !== "undefined" ? process.cwd() : undefined);
  const envBase: Record<string, string> = {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    LC_ALL: "C.UTF-8",
    OPENCODE_TERMINAL: "1",
    COLUMNS: String(cols),
    LINES: String(rows),
    ...(opts.env ?? {}),
  };

  // shell resolution per spec
  let shell = opts.shell;
  if (!shell) {
    if (platform === "win32") {
      // try pwsh -> powershell -> cmd.exe
      try {
        // @ts-ignore
        const which = (globalThis as unknown as { Bun?: { which: (s: string) => string | null } }).Bun?.which;
        if (which) {
          shell = which("pwsh") ?? which("powershell") ?? "cmd.exe";
        } else {
          shell = "cmd.exe";
        }
      } catch {
        shell = "cmd.exe";
      }
    } else {
      shell = (typeof process !== "undefined" ? process.env.SHELL : undefined) ?? "/bin/sh";
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

  const publishOpened = () => {
    opts.bus?.publish("pty", { kind: "opened", id, pid: procPid, title: shell, cols, rows });
  };
  const publishExited = (code: number) => {
    status = "exited";
    exitCode = code;
    opts.bus?.publish("pty", { kind: "exited", id, exitCode: code });
  };

  if (backendName === "node-pty") {
    const backend = await backendLoader.getNodePty();
    if (!backend) throw new Error("node-pty backend unavailable");
    // node-pty spawn signature: spawn(shell, args, { cols, rows, cwd, env })
    const proc = backend.spawn(shell!, [], { name: "xterm-256color", cols, rows, cwd, env: envBase });
    procPid = proc.pid;
    proc.onData((data) => {
      for (const cb of dataCbs) cb(data);
    });
    proc.onExit(({ exitCode: code }) => {
      publishExited(code);
    });
    writeFn = proc.write.bind(proc);
    resizeFn = proc.resize.bind(proc);
    killFn = () => {
      try { proc.kill(); } catch {}
    };
  } else {
    const backend = await backendLoader.getBun();
    if (!backend) throw new Error("bun-pty backend unavailable");
    const proc = backend.spawn({ cols, rows, cwd, shell, env: envBase });
    procPid = proc.pid;
    proc.onData((data) => {
      for (const cb of dataCbs) cb(data);
    });
    proc.onExit((code) => {
      publishExited(code);
    });
    writeFn = proc.write.bind(proc);
    resizeFn = proc.resize.bind(proc);
    killFn = () => {
      try { proc.kill(); } catch {}
    };
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
    onData: (cb) => {
      dataCbs.add(cb);
      return () => dataCbs.delete(cb);
    },
  };
}
