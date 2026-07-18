// pty/screen.ts — @xterm/headless wrapper, grid read. Imperative shell (thin).

export type XtermHeadless = {
  write: (data: string | Uint8Array) => void;
  resize: (cols: number, rows: number) => void;
  _core?: unknown;
};

let HeadlessCtor: unknown = null;

async function loadHeadless(): Promise<unknown> {
  if (HeadlessCtor) return HeadlessCtor;
  try {
    const mod: any = await import("@xterm/headless");
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

export async function createScreen(
  cols: number,
  rows: number,
): Promise<{
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  readGrid: () => ScreenGrid;
  dispose: () => void;
}> {
  const Ctor = (await loadHeadless()) as any;
  if (!Ctor) {
    let buffer = "";
    return {
      write: (d: string) => { buffer += d; },
      resize: () => {},
      readGrid: () => buffer.split("\n").map((line) => line.split("").map((ch) => ({ char: ch }))),
      dispose: () => {},
    };
  }

  const term: any = new Ctor({ cols, rows, allowProposedApi: true });

  return {
    write: (data: string) => term.write(data),
    resize: (c: number, r: number) => term.resize(c, r),
    readGrid: () => {
      const active = term.buffer?.active as
        | { length?: number; getLine?: (n: number) => { translateToString?: (t: boolean) => string } | null }
        | undefined;
      if (active?.getLine && typeof active.length === "number") {
        const rowsOut: ScreenGrid = [];
        for (let y = 0; y < active.length; y++) {
          const line = active.getLine(y);
          const str = (line?.translateToString?.(true) ?? line?.translateToString?.(false) ?? "") as string;
          rowsOut.push(str.split("").map((ch) => ({ char: ch })));
        }
        return rowsOut;
      }
      return [];
    },
    dispose: () => term.dispose(),
  };
}
