// pty/renderable.tsx — full-fidelity DIRECT blit (never bus per §4). Thin shell over FrameBufferRenderable.
// Real API (@opentui/core 0.4.3): OptimizedBuffer.setCell(x,y,char,fg,bg,attrs?) · setCellWithAlphaBlending · drawText · fillRect · drawFrameBuffer · drawBox
// TextAttributes bitmask BOLD DIM ITALIC UNDERLINE BLINK INVERSE STRIKETHROUGH. Global theme tokens only.

import { FrameBufferRenderable, TextAttributes, RGBA, type OptimizedBuffer, type RenderContext, type RenderableOptions } from "@opentui/core";
import { extend } from "@opentui/solid";

export type PtyCell = {
  char: string;
  fg?: string | number; // truecolor string or ansi index
  bg?: string | number;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strikethrough?: boolean;
};

export type PtyFrame = {
  cols: number;
  rows: number;
  cells: PtyCell[][]; // rows x cols
  cursorX: number;
  cursorY: number;
  cursorVisible: boolean;
};

type PtyRenderableOpts = RenderableOptions<FrameBufferRenderable> & {
  getFrame: () => PtyFrame | null;
  onResize?: (cols: number, rows: number) => void;
};

function attrsFromCell(cell: PtyCell): number {
  let a = 0;
  if (cell.bold) a |= TextAttributes.BOLD;
  if (cell.dim) a |= TextAttributes.DIM;
  if (cell.italic) a |= TextAttributes.ITALIC;
  if (cell.underline) a |= TextAttributes.UNDERLINE;
  if (cell.inverse) a |= TextAttributes.INVERSE;
  if (cell.strikethrough) a |= TextAttributes.STRIKETHROUGH;
  return a;
}

// ANSI-256 -> RGBA conversion (16 base + 6x6x6 cube + grayscale)
function ansi256ToRgba(index: number): RGBA {
  // simplified mapping — produce visible colors
  if (index < 16) {
    const base: [number, number, number][] = [
      [0, 0, 0], [205, 0, 0], [0, 205, 0], [205, 205, 0],
      [0, 0, 238], [205, 0, 205], [0, 205, 205], [229, 229, 229],
      [127, 127, 127], [255, 0, 0], [0, 255, 0], [255, 255, 0],
      [92, 92, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
    ];
    const [r, g, b] = base[index] ?? [255, 255, 255];
    return RGBA.fromInts(r, g, b, 255);
  }
  if (index < 232) {
    const n = index - 16;
    const b = n % 6;
    const g = Math.floor(n / 6) % 6;
    const r = Math.floor(n / 36);
    const toVal = (v: number) => (v === 0 ? 0 : 55 + v * 40);
    return RGBA.fromInts(toVal(r), toVal(g), toVal(b), 255);
  }
  const gray = 8 + (index - 232) * 10;
  return RGBA.fromInts(gray, gray, gray, 255);
}

function parseColor(input: string | number | undefined, fallback: RGBA): RGBA {
  if (typeof input === "number") return ansi256ToRgba(input);
  if (typeof input === "string") {
    // hex handling should not appear per G15, but support theme tokens via fallback
    if (input.startsWith("#")) {
      // Allow but G15 forbids in views only; for PTY truecolor pass-through we allow hex from terminal
      const hex = input.slice(1);
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return RGBA.fromInts(r, g, b, 255);
      }
    }
    // theme token? return fallback for now (theme resolution elsewhere)
    return fallback;
  }
  return fallback;
}

export class PtyRenderable extends FrameBufferRenderable {
  private getFrameFn: () => PtyFrame | null;
  private onResizeFn?: (cols: number, rows: number) => void;
  private lastCols = 0;
  private lastRows = 0;

  constructor(ctx: RenderContext, opts: PtyRenderableOpts) {
    super(ctx, { ...opts, live: true });
    this.getFrameFn = opts.getFrame;
    this.onResizeFn = opts.onResize;
  }

  protected override renderSelf(buffer: OptimizedBuffer): void {
    if (!this.visible || this.isDestroyed) return;
    const frame = this.getFrameFn();
    if (!frame) {
      super.renderSelf(buffer);
      return;
    }

    // Check resize
    const w = typeof this.width === "number" ? this.width : frame.cols;
    const h = typeof this.height === "number" ? this.height : frame.rows;
    if (w !== this.lastCols || h !== this.lastRows) {
      this.lastCols = w as number;
      this.lastRows = h as number;
      // Ensure framebuffer matches dimensions
      try {
        // @ts-ignore
        if (this.frameBuffer && (this.frameBuffer.width !== w || this.frameBuffer.height !== h)) {
          // @ts-ignore
          this.frameBuffer.resize?.(w as number, h as number);
        }
      } catch {}
      this.onResizeFn?.(w as number, h as number);
    }

    // blit only on contentDirty per spec — but renderSelf is called when dirty; we also gate via frameBuffer
    const fb = (this as unknown as { frameBuffer: OptimizedBuffer }).frameBuffer;
    if (!fb) {
      super.renderSelf(buffer);
      return;
    }

    const defaultFg = RGBA.fromInts(220, 220, 220, 255);
    const defaultBg = RGBA.fromInts(0, 0, 0, 255);

    // per visible cell fg/bg = truecolor or ANSI-256; attrs bitmask; swap on inverse; 6-arg setCell + painted INVERSE cursor
    for (let y = 0; y < frame.rows && y < frame.cells.length; y++) {
      const row = frame.cells[y];
      if (!row) continue;
      for (let x = 0; x < frame.cols && x < row.length; x++) {
        const cell = row[x];
        if (!cell) continue;
        let fg = parseColor(cell.fg, defaultFg);
        let bg = parseColor(cell.bg, defaultBg);
        let attrs = attrsFromCell(cell);

        // swap fg/bg on inverse
        if (cell.inverse) {
          const tmp = fg;
          fg = bg;
          bg = tmp;
          attrs |= TextAttributes.INVERSE;
        }

        // paint cursor INVERSE at cursor x/y when visible
        if (frame.cursorVisible && x === frame.cursorX && y === frame.cursorY) {
          // INVERSE cursor per spec
          const curFg = bg;
          const curBg = fg;
          // 6-arg setCell per T6
          fb.setCell(x, y, cell.char || " ", curFg, curBg, attrs | TextAttributes.INVERSE);
        } else {
          // 6-arg setCell — SIX args (T6): char fg bg attrs
          fb.setCell(x, y, cell.char || " ", fg, bg, attrs);
        }
      }
    }

    super.renderSelf(buffer);
  }
}

declare module "@opentui/solid" {
  interface OpenTUIComponents {
    pty_renderable: typeof PtyRenderable;
  }
}

extend({ pty_renderable: PtyRenderable });

// JSX wrapper for convenience
export function PtyRenderableView(props: {
  width?: number | string;
  height?: number | string;
  getFrame: () => PtyFrame | null;
  onResize?: (cols: number, rows: number) => void;
}) {
  // solid component — renders the custom renderable
  const { getFrame, onResize, width, height } = props;
  return (
    // @ts-ignore custom element
    <pty_renderable width={width ?? "100%"} height={height ?? "100%"} getFrame={getFrame} onResize={onResize} live />
  );
}
