// gate.ts — wraps client.session.prompt: dirty-check refuses task start, publishes gate event.
// I/O allowlist: owns git status via injected io.
// Task start = user-prompt seam invoking agent loop for new/idle/resumed session; nav/pane edits/terminal input NOT.

export type GateIo = {
  isRepo: () => boolean | Promise<boolean>;
  gitStatusPorcelain: () => string | Promise<string>;
};

export type GateBus = {
  publish: (topic: string, data: unknown) => void;
};

export type GateDecision = "allow" | "refuse";

export function isTaskStart(input: { type?: string; sessionStatus?: string }): boolean {
  // heuristic: only user prompt submissions are task starts
  const t = input.type ?? "";
  if (t === "user-prompt" || t === "prompt" || t === "task-start") return true;
  // session status idle -> about to start
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
    // git error => non-git => clean per spec
    return { dirty: false, isRepo: false };
  }
}

// Wrapper factory — returns a guarded prompt fn.
// If isRepo && dirty && isTaskStart -> publish refused, return PRE-ATTACHED rejected promise (no unhandled).
export function createGateWrapper<inputT, outputT>(opts: {
  original: (input: inputT) => Promise<outputT>;
  io: GateIo;
  bus?: GateBus;
  getIsTaskStart: (input: inputT) => boolean;
  getSystemOverride?: () => string | undefined;
}): (input: inputT) => Promise<outputT> {
  let pendingSystemOverride: string | undefined;

  // Called by views to queue an override; applied exactly once on next accepted prompt
  const setOverride = (o: string) => {
    pendingSystemOverride = o;
  };

  const guarded = async (input: inputT): Promise<outputT> => {
    const isStart = opts.getIsTaskStart(input);
    if (isStart) {
      const { dirty, isRepo } = await checkGateDirty(opts.io);
      if (isRepo && dirty) {
        opts.bus?.publish("checkout", { kind: "refused", reason: "dirty" });
        const err = new Error("Refused: dirty checkout");
        // PRE-ATTACHED rejected promise per spec — catch noop attached before return
        const p = Promise.reject(err);
        p.catch(() => {});
        return p as Promise<outputT>;
      }
    }

    // append systemOverride if queued
    let finalInput = input;
    const override = pendingSystemOverride ?? opts.getSystemOverride?.();
    if (override && isStart) {
      // join \n, applied exactly once
      const asRecord = input as Record<string, unknown>;
      if (asRecord && typeof asRecord.system === "string") {
        (asRecord as Record<string, unknown>).system = `${asRecord.system}\n${override}`;
      } else if (asRecord && Array.isArray(asRecord.system)) {
        (asRecord as Record<string, unknown>).system = [...(asRecord.system as string[]), override].join("\n");
      } else if (asRecord && isRecordInput(asRecord)) {
        asRecord.input = asRecord.input as typeof asRecord.input;
        // store override in input itself — caller shapes may vary
        (asRecord as Record<string, unknown>).__taudeskSystemOverride = override;
      }
      pendingSystemOverride = undefined;
      opts.bus?.publish("checkout", { kind: "sent", override });
    }

    const res = await opts.original(finalInput);
    return res;
  };

  (guarded as unknown as Record<string, unknown>).setSystemOverride = setOverride;

  return guarded as (input: inputT) => Promise<outputT>;
}

function isRecordInput(r: Record<string, unknown>): boolean {
  return true;
}
