// pty/renderable.tsx — full-fidelity DIRECT blit (never bus per §4). Thin shell over FrameBufferRenderable.
// Real API (@opentui/core 0.4.3): OptimizedBuffer.setCell(x,y,char,fg,bg,attrs?)

import { FrameBufferRenderable, TextAttributes, RGBA, type OptimizedBuffer, type RenderContext, type RenderableOptions } from "@opentui/core";
import { extend } from "@opentui/solid";

export type PtyCell = {
  char: string;
  fg?: string | number;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strikethrough?: boolean;
  bg?: string | number;
};

export type PtyFrame = {
  cols: number;
  rows: number;
  cells: PtyCell[][];
  cursorX: number;
  cursorY: number;
  cursorVisible: boolean;
};

type PtyRenderableOpts = RenderableOptions<FrameBufferRenderable> & {
  getFrame: () => PtyFrame | null;
  onResize?: (cols: number, rows: number) => void;
};

function attrsFromCell(cell: PtyCell): number {
  let attrs = 0;
  if (cell.bold) attrs |= TextAttributes.BOLD;
  if (cell.dim) attrs |= TextAttributes.DIM;
  if (cell.italic) attrs |= TextAttributes.ITALIC;
  if (cell.underline) attrs |= TextAttributes.UNDERLINE;
  if (cell.inverse) attrs |= TextAttributes.INVERSE;
  if (cell.strikethrough) attrs |= TextAttributes.STRIKETHROUGH;
  return attrs;
}

function ansi256ToRgba(index: number): RGBA {
  if (index < 16) {
    const palette: [number, number, number][] = [
      [0, 0, 0], [205, 0, 0], [0, 205, 0], [205, 205, 0],
      [0, 0, 238], [205, 0, 205], [0, 205, 205], [229, 229, 229],
      [127, 127, 127], [255, 0, 0], [0, 255, 0], [255, 255, 0],
      [92, 92, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
    ];
    const [r, g, b] = palette[index] ?? [255, 255, 255];
    return RGBA.fromInts(r, g, b, 255);
  }
  if (index < 232) {
    const n = index - 16;
    const b = n % 6;
    const g = Math.floor(n / 6) % 6;
    const r = Math.floor(n / 36);
    const toByte = (v: number) => (v === 0 ? 0 : 55 + v * 40);
    return RGBA.fromInts(toByte(r), toByte(g), toByte(b), 255);
  }
  const gray = 8 + (index - 232) * 10;
  return RGBA.fromInts(gray, gray, gray, 255);
}

function parseColor(input: string | number | undefined, fallback: RGBA): RGBA {
  if (typeof input === "number") return ansi256ToRgba(input);
  if (typeof input === "string" && input.startsWith("#")) {
    const hex = input.slice(1);
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return RGBA.fromInts(r, g, b, 255);
    }
  }
  return fallback;
}

export class PtyRenderable extends FrameBufferRenderable {
  private getFrameFn: () => PtyFrame | null;
  private onResizeFn?: (cols: number, rows: number) => void;
  private lastCols = 0;
  private lastRows = 0;

  constructor(ctx: RenderContext, opts: PtyRenderableOpts) {
    // Why cast: RenderableOptions width/height accept "auto"/"%" in JSX but FrameBufferOptions in core expects number;
    // runtime handles both, type mismatch is upstream.
    super(ctx, { ...(opts as unknown as RenderableOptions<FrameBufferRenderable>), live: true } as never);
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

    const cols = frame.cols;
    const rows = frame.rows;
    if (cols !== this.lastCols || rows !== this.lastRows) {
      this.lastCols = cols;
      this.lastRows = rows;
      try {
        const framebuffer = (this as unknown as { frameBuffer: OptimizedBuffer & { resize?: (w: number, h: number) => void } }).frameBuffer;
        if (framebuffer) framebuffer.resize?.(cols, rows);
      } catch (error) {
        // Why swallow: resize may throw if framebuffer not yet initialized; safe to ignore, next render will retry.
        void error;
      }
      this.onResizeFn?.(cols, rows);
    }

    const fb = (this as unknown as { frameBuffer: OptimizedBuffer }).frameBuffer;
    if (!fb) {
      super.renderSelf(buffer);
      return;
    }

    const defaultFg = RGBA.fromInts(220, 220, 220, 255);
    const defaultBg = RGBA.fromInts(0, 0, 0, 255);

    for (let y = 0; y < frame.rows && y < frame.cells.length; y++) {
      const row = frame.cells[y];
      if (!row) continue;
      for (let x = 0; x < frame.cols && x < row.length; x++) {
        const cell = row[x];
        if (!cell) continue;
        let fg = parseColor(cell.fg, defaultFg);
        let bg = parseColor(cell.bg, defaultBg);
        let attrs = attrsFromCell(cell);
        if (cell.inverse) {
          const tmp = fg;
          fg = bg;
          bg = tmp;
          attrs |= TextAttributes.INVERSE;
        }
        if (frame.cursorVisible && x === frame.cursorX && y === frame.cursorY) {
          fb.setCell(x, y, cell.char || " ", bg, fg, attrs | TextAttributes.INVERSE);
        } else {
          // 6-arg setCell per T6 — SIX args mandatory
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
