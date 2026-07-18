// pty/screen.ts — @xterm/headless wrapper, grid read. Imperative shell (thin).

export type XtermHeadless = {
  write: (data: string | Uint8Array) => void;
  resize: (cols: number, rows: number) => void;
  // headless API shape may vary; we wrap for grid read
  _core?: unknown;
};

let HeadlessCtor: unknown = null;

async function loadHeadless(): Promise<unknown> {
  if (HeadlessCtor) return HeadlessCtor;
  try {
    // lazy import — non-PTY users never load native binding per B5
    const mod = await import("@xterm/headless");
    // @ts-ignore
    HeadlessCtor = mod.Terminal ?? mod.default ?? null;
    return HeadlessCtor;
  } catch {
    return null;
  }
}

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

export async function createScreen(cols: number, rows: number): Promise<{
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  readGrid: () => ScreenGrid;
  dispose: () => void;
}> {
  const Ctor = (await loadHeadless()) as unknown as new (opts: unknown) => {
    write: (d: string) => void;
    resize: (c: number, r: number) => void;
    dispose: () => void;
    // Access buffer via _core or buffer
    buffer?: { active?: { getLine?: (n: number) => { translateToString?: (trim: boolean) => string } | null; length?: number } };
    _core?: { service?: unknown };
    cols: number;
    rows: number;
  } | null;

  if (!Ctor) {
    // fallback: no headless available — return stub that buffers raw
    let buffer = "";
    return {
      write: (d: string) => { buffer += d; },
      resize: () => {},
      readGrid: () => buffer.split("\n").map((line) => line.split("").map((ch) => ({ char: ch }))),
      dispose: () => {},
    };
  }

  const term = new Ctor({ cols, rows, allowProposedApi: true });

  return {
    write: (data: string) => term.write(data),
    resize: (c: number, r: number) => term.resize(c, r),
    readGrid: () => {
      // Best-effort grid read — if buffer API present, translate
      const active = (term as { buffer?: { active?: unknown } }).buffer?.active as
        | { length?: number; getLine?: (n: number) => { translateToString?: (t: boolean) => string } | null }
        | undefined;
      if (active?.getLine && typeof active.length === "number") {
        const rowsOut: ScreenGrid = [];
        for (let y = 0; y < active.length; y++) {
          const line = active.getLine(y);
          const str = line?.translateToString?.(true) ?? line?.translateToString?.(false) ?? "";
          rowsOut.push(str.split("").map((ch) => ({ char: ch })));
        }
        return rowsOut;
      }
      return [];
    },
    dispose: () => term.dispose(),
  };
}
