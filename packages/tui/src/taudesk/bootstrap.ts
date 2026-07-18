// bootstrap.ts — owns process.cwd() + instruction file discovery. I/O allowlist.
// Views do no FS; this file owns fs discovery via injected io.

export type BootstrapIo = {
  cwd: () => string;
  exists: (path: string) => boolean | Promise<boolean>;
  join: (...parts: string[]) => string;
};

const INSTRUCTION_FILES = ["AGENTS.md", "CLAUDE.md", "CONTEXT.md"] as const;

export function getBootstrapCwd(): string {
  return process.cwd();
}

export async function findInstructionFile(dir: string, io: BootstrapIo): Promise<string | undefined> {
  for (const fileName of INSTRUCTION_FILES) {
    const candidatePath = io.join(dir, fileName);
    try {
      if (await io.exists(candidatePath)) return candidatePath;
    } catch (error) {
      // Why swallow: existence check is best-effort discovery; failure means treat as not found, not hard error.
      // Tradeoff: log at debug level would be noisy for bootstrap; returning undefined keeps flow resilient.
      void error;
    }
  }
  return undefined;
}

export async function bootstrapTaudesk(io: BootstrapIo) {
  const cwd = io.cwd();
  const instructionFile = await findInstructionFile(cwd, io);
  return { cwd, instructionFile };
}
