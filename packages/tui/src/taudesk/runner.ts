// runner.ts — verify runner. I/O allowlist: owns Bun.spawn pipe, publish redacted output.
// Cwd containment: resolve + reject escape same rule as config.

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

function resolveAndContain(base: string, requested: string | undefined, resolve: (...p: string[]) => string): string {
  if (!requested) return base;
  // reject absolute and .. traversal
  const normalized = requested.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) {
    throw new Error(`absolute cwd not allowed: ${requested}`);
  }
  if (normalized.split("/").includes("..")) {
    throw new Error(`traversal cwd not allowed: ${requested}`);
  }
  const joined = resolve(base, requested);
  const baseResolved = resolve(base);
  // containment check: joined must start with baseResolved
  const rel = path.relative(baseResolved, joined);
  if (rel.startsWith("..") || path.isAbsolute(rel) && rel !== "") {
    // Alternative check using string prefix for win32
    if (!joined.startsWith(baseResolved)) {
      throw new Error(`cwd escapes base: ${requested}`);
    }
  }
  return joined;
}

export async function runVerifyCommand(
  cmd: VerifyCommand,
  opts: { baseDir: string; bus?: RunnerBus; io: RunnerIo },
): Promise<{ exitCode: number; output: string }> {
  const cwd = resolveAndContain(opts.baseDir, cmd.cwd, opts.io.resolve);
  const command = typeof cmd.command === "string" ? [cmd.command] : cmd.command;
  const timeoutMs = cmd.timeout_ms ?? 60000;
  const OUTPUT_CAP = 200 * 1024; // 200KiB

  opts.bus?.publish("verify", { kind: "started", name: cmd.name, command });

  let output = "";
  let exitCode = 0;

  try {
    // Real spawn path — uses injected io
    // For Bun, cmd[0] is shell? We support string command via shell -c fallback
    const spawnOpts = Array.isArray(cmd.command)
      ? { cmd: command as string[], cwd, timeoutMs }
      : { cmd: ["/bin/sh", "-c", command[0]] as string[], cwd, timeoutMs };

    // If Bun is available, use its shape; else fallback already wrapped in io
    const proc = opts.io.spawn({
      cmd: spawnOpts.cmd,
      cwd: spawnOpts.cwd,
      timeoutMs: spawnOpts.timeoutMs,
    });

    const decoder = new TextDecoder();

    async function readStream(
      stream: ReadableStream<Uint8Array> | { getReader(): { read(): Promise<{ value?: Uint8Array; done: boolean }> } },
    ) {
      // Handle both web streams and custom
      if (stream instanceof ReadableStream) {
        const reader = stream.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            let chunk = decoder.decode(value, { stream: true });
            // redact at publish per T4
            chunk = redactText(chunk);
            if (output.length < OUTPUT_CAP) {
              const remaining = OUTPUT_CAP - output.length;
              output += chunk.slice(0, remaining);
            }
            opts.bus?.publish("verify", { kind: "output", name: cmd.name, chunk });
          }
        }
      } else {
        const reader = stream.getReader();
        while (true) {
          const res = await reader.read();
          if (res.done) break;
          if (res.value) {
            let chunk = decoder.decode(res.value as Uint8Array, { stream: true });
            chunk = redactText(chunk);
            if (output.length < OUTPUT_CAP) {
              output += chunk.slice(0, OUTPUT_CAP - output.length);
            }
            opts.bus?.publish("verify", { kind: "output", name: cmd.name, chunk });
          }
        }
      }
    }

    const outP = readStream(proc.stdout as never);
    const errP = readStream(proc.stderr as never);

    // timeout race
    const timeoutPromise = new Promise<number>((_, rej) => {
      setTimeout(() => {
        try {
          proc.kill();
        } catch {}
        rej(new Error(`timeout ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const exitPromise = proc.exited;

    try {
      exitCode = await Promise.race([exitPromise, timeoutPromise] as Promise<number>[]);
    } catch {
      exitCode = 124;
      output += `\n[timeout after ${timeoutMs}ms]`;
    }

    await Promise.allSettled([outP, errP]);

    opts.bus?.publish("verify", { kind: "exited", name: cmd.name, exitCode });
    return { exitCode, output };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const redacted = redactText(msg);
    opts.bus?.publish("verify", { kind: "exited", name: cmd.name, exitCode: 1, error: redacted });
    return { exitCode: 1, output: output + `\n${redacted}` };
  }
}
