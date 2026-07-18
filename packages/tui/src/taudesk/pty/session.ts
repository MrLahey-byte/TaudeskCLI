// pty/session.ts — manager publishes ONLY terminal.opened/exited on bus. EPHEMERAL no disk writes.
// SIGWINCH chain: pane resize -> renderable.onResize -> session.resize -> proc.resize.
// Shell resolution: win32 Bun.which(pwsh)->powershell->cmd.exe else $SHELL||/bin/sh. Why: matches OpenCode terminal detection.

import { selectPtyBackendName } from "./select-backend.ts";

export type PtySessionBus = {
  publish: (topic: string, data: unknown) => void;
};

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

type PtyProc = {
  pid?: number;
  onData?: (cb: (data: string) => void) => void;
  on?: (event: "data" | "exit", cb: (data: unknown) => void) => void;
  onExit?: (cb: (code: number | { exitCode?: number; code?: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
};

type BackendLoader = {
  getBun: () => Promise<{ spawn: (...args: unknown[]) => PtyProc } | null>;
  getNodePty: () => Promise<{ spawn: (shell: string, args: string[], opts: unknown) => PtyProc } | null>;
};

let sessionCounter = 0;

export function createPtySessionId(): string {
  sessionCounter += 1;
  return `pty_${sessionCounter}_${Date.now()}`;
}

function resolveShell(platform: string, requested?: string): string {
  if (requested) return requested;
  if (platform === "win32") {
    try {
      const bunGlobal = globalThis as { Bun?: { which: (name: string) => string | null } };
      const which = bunGlobal.Bun?.which;
      if (which) return which("pwsh") ?? which("powershell") ?? "cmd.exe";
    } catch {
      // Why catch: Bun.which may throw when not in Bun runtime; fallback to cmd.exe
    }
    return "cmd.exe";
  }
  const shellFromEnv = (process as { env?: { SHELL?: string } }).env?.SHELL;
  return shellFromEnv ?? "/bin/sh";
}

function resolveCwd(requested?: string): string | undefined {
  if (requested) return requested;
  try {
    const cwd = (process as { cwd?: () => string }).cwd;
    return cwd?.();
  } catch {
    return undefined;
  }
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
  backendLoader: BackendLoader = {
    getBun: async () => {
      const mod = await import("./bun-backend.ts");
      return (mod as { getBunPtyBackend: () => Promise<unknown> }).getBunPtyBackend() as Promise<{ spawn: (...args: unknown[]) => PtyProc } | null>;
    },
    getNodePty: async () => {
      const mod = await import("./node-pty-backend.ts");
      return (mod as { getNodePtyBackend: () => Promise<unknown> }).getNodePtyBackend() as Promise<{ spawn: (shell: string, args: string[], opts: unknown) => PtyProc } | null>;
    },
  },
): Promise<PtySession> {
  const platform = opts.platform ?? (process as { platform?: string }).platform ?? "linux";
  const backendName = selectPtyBackendName(platform);
  const cols = opts.cols;
  const rows = opts.rows;
  const cwd = resolveCwd(opts.cwd);
  const shell = resolveShell(platform, opts.shell);
  const envBase: Record<string, string> = {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    LC_ALL: "C.UTF-8",
    OPENCODE_TERMINAL: "1",
    COLUMNS: String(cols),
    LINES: String(rows),
    ...(opts.env ?? {}),
  };

  const id = createPtySessionId();
  const dataSubscribers = new Set<(data: string) => void>();
  let status: "running" | "exited" = "running";
  let exitCode: number | undefined;
  let processId = 0;

  function publishOpened() {
    opts.bus?.publish("pty", { kind: "opened", id, pid: processId, title: shell, cols, rows });
  }

  function publishExited(code: number) {
    status = "exited";
    exitCode = code;
    opts.bus?.publish("pty", { kind: "exited", id, exitCode: code });
  }

  function attachDataHandler(proc: PtyProc) {
    if (proc.onData) {
      proc.onData((data) => {
        for (const subscriber of dataSubscribers) subscriber(data);
      });
    } else if (proc.on) {
      proc.on("data", (data) => {
        for (const subscriber of dataSubscribers) subscriber(String(data));
      });
    }
  }

  function attachExitHandler(proc: PtyProc) {
    if (proc.onExit) {
      proc.onExit((codeOrEvent) => {
        const code = typeof codeOrEvent === "number" ? codeOrEvent : (codeOrEvent as { exitCode?: number; code?: number }).exitCode ?? (codeOrEvent as { code?: number }).code ?? 0;
        publishExited(code);
      });
    } else if (proc.on) {
      proc.on("exit", (event) => {
        const code = (event as { exitCode?: number } | undefined)?.exitCode ?? 0;
        publishExited(code);
      });
    }
  }

  const noopWrite = (_data: string): void => {};
  const noopResize = (_cols: number, _rows: number): void => {};
  const noopKill = (): void => {};

  let writeFn: (data: string) => void = noopWrite;
  let resizeFn: (cols: number, rows: number) => void = noopResize;
  let killFn: () => void = noopKill;

  if (backendName === "node-pty") {
    const backend = await backendLoader.getNodePty();
    if (!backend) throw new Error("node-pty backend unavailable");
    const proc = backend.spawn(shell, [], { name: "xterm-256color", cols, rows, cwd, env: envBase });
    processId = proc.pid ?? 0;
    attachDataHandler(proc);
    attachExitHandler(proc);
    writeFn = proc.write.bind(proc);
    resizeFn = proc.resize.bind(proc);
    killFn = () => {
      try {
        proc.kill();
      } catch (error) {
        console.error("[taudesk pty] kill failed", error);
      }
    };
  } else {
    const backend = await backendLoader.getBun();
    if (!backend) throw new Error("bun-pty backend unavailable");
    // bun-pty 0.4.8 has two signatures: (shell,args,opts) and (opts). Try shell-first first.
    let proc: PtyProc;
    try {
      proc = backend.spawn(shell, [], { cols, rows, cwd, env: envBase } as unknown) as PtyProc;
    } catch {
      proc = (backend.spawn as (opts: unknown) => PtyProc)({ cols, rows, cwd, shell, env: envBase });
    }
    processId = proc.pid ?? 0;
    attachDataHandler(proc);
    attachExitHandler(proc);
    writeFn = (data) => {
      try {
        proc.write(data);
      } catch (error) {
        console.error("[taudesk pty] write failed", error);
      }
    };
    resizeFn = (c, r) => {
      try {
        proc.resize(c, r);
      } catch (error) {
        console.error("[taudesk pty] resize failed", error);
      }
    };
    killFn = () => {
      try {
        proc.kill();
      } catch (error) {
        console.error("[taudesk pty] kill failed", error);
      }
    };
  }

  publishOpened();

  return {
    get id() {
      return id;
    },
    get pid() {
      return processId;
    },
    get title() {
      return shell;
    },
    get cols() {
      return cols;
    },
    get rows() {
      return rows;
    },
    get status() {
      return status;
    },
    get exitCode() {
      return exitCode;
    },
    write: (data) => writeFn(data),
    resize: (c, r) => resizeFn(c, r),
    kill: () => killFn(),
    onData: (callback) => {
      dataSubscribers.add(callback);
      return () => dataSubscribers.delete(callback);
    },
  };
}
