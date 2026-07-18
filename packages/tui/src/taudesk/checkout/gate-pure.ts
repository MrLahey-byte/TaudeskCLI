// checkout/gate-pure.ts — pure helpers for dirty checkout detection.
// tune: no knobs; porcelain format stable.

export function isCheckoutClean(porcelain: string): boolean {
  return porcelain.trim().length === 0;
}

export type GitDirtyResult = { isGit: boolean; dirty: boolean; porcelain: string };

export function parseGitStatusPorcelain(output: string, exitCode: number): GitDirtyResult {
  if (exitCode !== 0) {
    // non-git or error => treat as clean per spec
    return { isGit: false, dirty: false, porcelain: "" };
  }
  return {
    isGit: true,
    dirty: output.trim().length !== 0,
    porcelain: output,
  };
}
