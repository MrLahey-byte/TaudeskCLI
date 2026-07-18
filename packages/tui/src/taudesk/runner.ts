// runner.ts — verify runner. I/O allowlist owns Bun.spawn pipe, publishes redacted output.
// Cwd containment: resolve + reject escape same rule as config. Fail-closed for traversal.

import { redactText } from "./redact.ts";
import path from "node:path";

export type RunnerIo = {
  spawn: (opts: { cmd: string[]; cwd: string; env?: Record<string, string>; timeoutMs?: number }) => {
    stdout: ReadableStream<Uint8Array> | { getReader(): { read(): Promise<{ value?: Uint8Array; done: boolean }> } };
    stderr: ReadableStream<Uint8Array> | { getReader(): { read(): Promise<{ value?: Uint8Array; done: boolean }> } };
    exited: Promise<number>;
    kill: () => void;
  };
  resolve: (...parts: string[]) => string;
};

export type VerifyCommand = {
  name: string;
  command: string | string[];
  cwd?: string;
  timeout_ms?: number;
};

export type RunnerBus = {
  publish: (topic: string, data: unknown) => void;
};

function rejectAbsolutePath(requested: string): boolean {
  const normalized = requested.replace(/\\/g, "/");
  return normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized);
}

function hasTraversalSegment(requested: string): boolean {
  return requested.replace(/\\/g, "/").split("/").includes("..");
}

function resolveAndContain(base: string, requested: string | undefined, resolve: (...p: string[]) => string): string {
  if (!requested) return base;
  if (rejectAbsolutePath(requested)) throw new Error(`absolute cwd not allowed: ${requested}`);
  if (hasTraversalSegment(requested)) throw new Error(`traversal cwd not allowed: ${requested}`);

  const joined = resolve(base, requested);
  const baseResolved = resolve(base);
  const relative = path.relative(baseResolved, joined);

  if (relative.startsWith("..") && !joined.startsWith(baseResolved)) {
    throw new Error(`cwd escapes base: ${requested}`);
  }
  return joined;
}

type ByteSource = ReadableStream<Uint8Array> | { getReader(): { read(): Promise<{ value?: Uint8Array; done: boolean }> } };

async function drainToOutput(
  source: ByteSource,
  decode: (chunk: Uint8Array, flush?: boolean) => string,
  onChunk: (redactedChunk: string) => void,
  outputRef: { text: string },
): Promise<void> {
  const reader = source instanceof ReadableStream ? source.getReader() : source.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    const raw = decode(value as Uint8Array);
    const redacted = redactText(raw);
    if (outputRef.text.length < 200 * 1024) {
      outputRef.text += redacted.slice(0, 200 * 1024 - outputRef.text.length);
    }
    onChunk(redacted);
  }
}

export async function runVerifyCommand(
  cmd: VerifyCommand,
  opts: { baseDir: string; bus?: RunnerBus; io: RunnerIo },
): Promise<{ exitCode: number; output: string }> {
  const cwd = resolveAndContain(opts.baseDir, cmd.cwd, opts.io.resolve);
  const commands = typeof cmd.command === "string" ? [cmd.command] : cmd.command;
  const timeoutMs = cmd.timeout_ms ?? 60000;

  opts.bus?.publish("verify", { kind: "started", name: cmd.name, command: commands });

  const outputRef = { text: "" };
  let exitCode = 0;

  try {
    const spawnCommand = Array.isArray(cmd.command) ? (commands as string[]) : ["/bin/sh", "-c", commands[0]];
    const proc = opts.io.spawn({ cmd: spawnCommand, cwd, timeoutMs });
    const decoder = new TextDecoder();

    function publishOutputChunk(chunk: string) {
      opts.bus?.publish("verify", { kind: "output", name: cmd.name, chunk });
    }

    const outTask = drainToOutput(proc.stdout, (b) => decoder.decode(b, { stream: true }), publishOutputChunk, outputRef);
    const errTask = drainToOutput(proc.stderr, (b) => decoder.decode(b, { stream: true }), publishOutputChunk, outputRef);

    const timeout = new Promise<number>((_, reject) => {
      setTimeout(() => {
        try {
          proc.kill();
        } catch (error) {
          // Why swallow kill failure: proc may already be dead; timeout path still needs to reject to trigger fallback exit code 124
          void error;
        }
        reject(new Error(`timeout ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      exitCode = await Promise.race([proc.exited, timeout]);
    } catch (timeoutError) {
      // Why 124: conventional timeout exit code, distinguishes from spawn failure (1) per B3 runner spec
      void timeoutError;
      exitCode = 124;
      outputRef.text += `\n[timeout after ${timeoutMs}ms]`;
    }

    await Promise.allSettled([outTask, errTask]);

    opts.bus?.publish("verify", { kind: "exited", name: cmd.name, exitCode });
    return { exitCode, output: outputRef.text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const redacted = redactText(message);
    opts.bus?.publish("verify", { kind: "exited", name: cmd.name, exitCode: 1, error: redacted });
    return { exitCode: 1, output: `${outputRef.text}\n${redacted}` };
  }
}
