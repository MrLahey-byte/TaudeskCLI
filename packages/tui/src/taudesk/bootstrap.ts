// bootstrap.ts — owns process.cwd() + instruction file discovery. I/O allowlist.
// views do no FS; this file owns fs discovery via injected io.

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
  for (const name of INSTRUCTION_FILES) {
    const p = io.join(dir, name);
    try {
      if (await io.exists(p)) return p;
    } catch {}
  }
  return undefined;
}

export async function bootstrapTaudesk(io: BootstrapIo) {
  const cwd = io.cwd();
  const instructionFile = await findInstructionFile(cwd, io);
  return { cwd, instructionFile };
}
