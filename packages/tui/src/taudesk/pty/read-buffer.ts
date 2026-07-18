// pty/read-buffer.ts — pure viewport read.
export type CellLike = { char?: string; text?: string; content?: string };

export function readVisibleLines(
  lines: CellLike[][],
  viewport: { top: number; height: number },
): string[] {
  const out: string[] = [];
  const start = Math.max(0, viewport.top);
  const end = Math.min(lines.length, start + viewport.height);
  for (let y = start; y < end; y++) {
    const row = lines[y];
    if (!row) continue;
    const text = row.map((c) => c.char ?? c.text ?? c.content ?? " ").join("").replace(/\s+$/, "");
    out.push(text);
  }
  return out;
}

export function readVisibleLinesFromStrings(
  buffer: string[],
  viewport: { top: number; height: number },
): string[] {
  const start = Math.max(0, viewport.top);
  const end = Math.min(buffer.length, start + viewport.height);
  return buffer.slice(start, end);
}
