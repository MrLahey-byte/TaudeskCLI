// suggest.ts — pure commit message suggestion.
// tune: max 72 chars for title (conventional).

export type DiffStat = { file: string; add: number; del: number };

export function suggestCommitMessage(diffs: DiffStat[], title?: string): string {
  if (diffs.length === 0) return "No changes";
  if (diffs.length === 1) {
    const msg = `Update ${diffs[0].file}`;
    return msg.length > 72 ? msg.slice(0, 69) + "..." : msg;
  }
  const totalAdd = diffs.reduce((a, d) => a + d.add, 0);
  const totalDel = diffs.reduce((a, d) => a + d.del, 0);
  const lock = diffs.every((d) => /lock|pnpm-lock|bun\.lockb|package-lock/i.test(d.file));
  let kind: string;
  if (lock) kind = "chore";
  else if (totalDel > 2 * totalAdd) kind = "refactor";
  else if (totalDel > totalAdd) kind = "fix";
  else kind = "feat";

  // common top dir scope
  const dirs = diffs.map((d) => d.file.split("/").slice(0, -1).join("/")).filter(Boolean);
  let scope = "";
  if (dirs.length > 0) {
    const first = dirs[0].split("/");
    let common: string[] = [...first];
    for (const dir of dirs.slice(1)) {
      const parts = dir.split("/");
      const next: string[] = [];
      for (let i = 0; i < Math.min(common.length, parts.length); i++) {
        if (common[i] === parts[i]) next.push(common[i]);
        else break;
      }
      common = next;
      if (common.length === 0) break;
    }
    scope = common.join("/");
  }

  const body = `update ${diffs.length} files (+${totalAdd}/-${totalDel})`;
  const titlePart = title ? `${title}: ` : "";
  let msg = scope ? `${kind}(${scope}): ${body}` : `${kind}: ${body}`;
  // keep title within 72 when we include optional override
  if (msg.length > 72) msg = msg.slice(0, 72);
  return `${titlePart}${msg}`.slice(0, 72);
}
