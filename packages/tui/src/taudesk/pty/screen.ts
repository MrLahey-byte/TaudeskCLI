// pty/screen.ts — @xterm/headless wrapper, grid read. Imperative shell thin, lazy-loaded per B5.

export type ScreenCell = {
  char: string;
  fg?: number;
  bg?: number;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
};

export type ScreenGrid = ScreenCell[][];

type HeadlessTerminal = {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  dispose: () => void;
  buffer?: {
    active?: {
      getLine?: (n: number) => { translateToString?: (trim: boolean) => string } | null;
      length?: number;
    };
  };
};

let CachedTerminal: (new (opts: unknown) => HeadlessTerminal) | null = null;
let loadAttempted = false;

async function loadHeadless(): Promise<(new (opts: unknown) => HeadlessTerminal) | null> {
  if (loadAttempted) return CachedTerminal;
  loadAttempted = true;
  try {
    const rawModule = (await import("@xterm/headless")) as unknown as {
      Terminal?: unknown;
      default?: unknown;
    };
    const candidates = [rawModule.Terminal, rawModule.default];
    for (const candidate of candidates) {
      if (typeof candidate === "function") {
        CachedTerminal = candidate as unknown as new (opts: unknown) => HeadlessTerminal;
        return CachedTerminal;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function createFallbackScreen(): {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  readGrid: () => ScreenGrid;
  dispose: () => void;
} {
  let buffer = "";
  return {
    write: (data) => { buffer += data; },
    resize: () => {},
    readGrid: () => buffer.split("\n").map((line) => line.split("").map((ch) => ({ char: ch }))),
    dispose: () => {},
  };
}

export async function createScreen(
  cols: number,
  rows: number,
): Promise<{
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  readGrid: () => ScreenGrid;
  dispose: () => void;
}> {
  const TerminalCtor = await loadHeadless();
  if (!TerminalCtor) return createFallbackScreen();

  const terminal = new TerminalCtor({ cols, rows, allowProposedApi: true });

  return {
    write: (data) => terminal.write(data),
    resize: (c, r) => terminal.resize(c, r),
    readGrid: () => {
      const active = terminal.buffer?.active;
      if (!active?.getLine || typeof active.length !== "number") return [];
      const rowsOut: ScreenGrid = [];
      for (let y = 0; y < active.length; y++) {
        const line = active.getLine(y);
        const text = (line?.translateToString?.(true) ?? line?.translateToString?.(false) ?? "") as string;
        rowsOut.push(text.split("").map((ch) => ({ char: ch })));
      }
      return rowsOut;
    },
    dispose: () => terminal.dispose(),
  };
}
