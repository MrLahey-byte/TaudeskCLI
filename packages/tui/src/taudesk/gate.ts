// gate.ts — wraps prompt: dirty-check refuses task start, publishes gate event.
// I/O allowlist owns git status via injected io.
// Task start = user-prompt seam invoking agent loop for new/idle/resumed session; nav/pane edits/terminal input NOT.
// Fail-closed: dirty repo refuses new tasks, but non-task starts (nav) pass through.

export type GateIo = {
  isRepo: () => boolean | Promise<boolean>;
  gitStatusPorcelain: () => string | Promise<string>;
};

export type GateBus = {
  publish: (topic: string, data: unknown) => void;
};

export type GateDecision = "allow" | "refuse";

export function isTaskStart(input: { type?: string; sessionStatus?: string }): boolean {
  const t = input.type ?? "";
  if (t === "user-prompt" || t === "prompt" || t === "task-start") return true;
  if (input.sessionStatus === "idle") return true;
  return false;
}

export async function checkGateDirty(io: GateIo): Promise<{ dirty: boolean; isRepo: boolean }> {
  try {
    const isRepo = await io.isRepo();
    if (!isRepo) return { dirty: false, isRepo: false };
    const porcelain = await io.gitStatusPorcelain();
    return { dirty: porcelain.trim().length !== 0, isRepo: true };
  } catch {
    // Non-git repo or git error — treat as clean per spec; why not throw: dirty-check is advisory gate, not hard failure
    return { dirty: false, isRepo: false };
  }
}

export function createGateWrapper<InputT, OutputT>(opts: {
  original: (input: InputT) => Promise<OutputT>;
  io: GateIo;
  bus?: GateBus;
  getIsTaskStart: (input: InputT) => boolean;
  getSystemOverride?: () => string | undefined;
}): (input: InputT) => Promise<OutputT> {
  let pendingSystemOverride: string | undefined;

  const guarded = async (input: InputT): Promise<OutputT> => {
    const isStart = opts.getIsTaskStart(input);
    if (isStart) {
      const { dirty, isRepo } = await checkGateDirty(opts.io);
      if (isRepo && dirty) {
        opts.bus?.publish("checkout", { kind: "refused", reason: "dirty" });
        const err = new Error("Refused: dirty checkout");
        // PRE-ATTACHED rejected promise per spec to avoid unhandled rejection tracking — why catch noop: promise is returned rejected, attachment must exist before return
        const p = Promise.reject(err);
        p.catch(() => {});
        return p as Promise<OutputT>;
      }
    }

    let finalInput = input;
    const override = pendingSystemOverride ?? opts.getSystemOverride?.();
    if (override && isStart) {
      const rec = input as unknown as { system?: unknown; [k: string]: unknown };
      if (rec && typeof rec.system === "string") {
        rec.system = `${rec.system}\n${override}`;
      } else if (rec && Array.isArray(rec.system)) {
        rec.system = [...(rec.system as string[]), override].join("\n");
      } else if (rec) {
        // Generic shape — store override for downstream wrapper to consume; why mutate: prompt input shapes vary across SDK versions
        rec.__taudeskSystemOverride = override;
      }
      pendingSystemOverride = undefined;
      opts.bus?.publish("checkout", { kind: "sent", override });
    }

    return opts.original(finalInput);
  };

  // Expose setter for system prompt override — why property on function: allows views to queue override without extra context
  type WithSetter = typeof guarded & { setSystemOverride: (s: string) => void };
  (guarded as WithSetter).setSystemOverride = (s: string) => {
    pendingSystemOverride = s;
  };

  return guarded;
}
