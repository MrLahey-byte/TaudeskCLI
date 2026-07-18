// floor.ts — Tier1/Tier2/Tier3 assessment. Pure core, no OpenTUI/bus deps.
// tune: no knobs; verdicts binary from observed probes.

export type TierVerdict = "KEEP" | "DEGRADED" | "LOST" | "OUT_OF_SCOPE";

export type FloorProbe = {
  multiProviderRouting: boolean;
  sessionPersistence: boolean;
  headlessCli: boolean;
  diffBeforeApply: boolean;
  pluginSystem: boolean;
  // Tier2 optional
  lspFallback?: boolean;
  reconnectResume?: boolean;
  subagentReachable?: boolean;
  sidebarMigration?: boolean;
  scrollbackEphemeral?: boolean;
};

export type TierResult = {
  tier: 1 | 2 | 3;
  name: string;
  verdict: TierVerdict;
  required: boolean;
};

export type FloorReport = {
  tier1: TierResult[];
  tier2: TierResult[];
  tier3: TierResult[];
  allKeep: boolean;
};

export function assessFloor(probe: FloorProbe): FloorReport {
  const tier1: TierResult[] = [
    { tier: 1, name: "multi-provider routing", verdict: probe.multiProviderRouting ? "KEEP" : "LOST", required: true },
    { tier: 1, name: "session persistence", verdict: probe.sessionPersistence ? "KEEP" : "LOST", required: true },
    { tier: 1, name: "headless opencode -p", verdict: probe.headlessCli ? "KEEP" : "LOST", required: true },
    { tier: 1, name: "Plan/Build diff-before-apply", verdict: probe.diffBeforeApply ? "KEEP" : "LOST", required: true },
    { tier: 1, name: "plugin system", verdict: probe.pluginSystem ? "KEEP" : "LOST", required: true },
  ];
  const tier2: TierResult[] = [
    { tier: 2, name: "LSP -> verify commands", verdict: probe.lspFallback ? "KEEP" : "DEGRADED", required: false },
    { tier: 2, name: "reconnect/resume", verdict: probe.reconnectResume ? "KEEP" : "DEGRADED", required: false },
    { tier: 2, name: "subagent/Explore keybind", verdict: probe.subagentReachable ? "KEEP" : "DEGRADED", required: false },
    { tier: 2, name: "sidebar plugins migration", verdict: probe.sidebarMigration ? "KEEP" : "DEGRADED", required: false },
    { tier: 2, name: "scrollback ephemeral", verdict: probe.scrollbackEphemeral ? "KEEP" : "DEGRADED", required: false },
  ];
  const tier3: TierResult[] = [
    { tier: 3, name: "desktop/web parity", verdict: "OUT_OF_SCOPE", required: false },
    { tier: 3, name: "Zen marketplace", verdict: "OUT_OF_SCOPE", required: false },
    { tier: 3, name: "PR-review triggers", verdict: "OUT_OF_SCOPE", required: false },
    { tier: 3, name: "cross-project tabs", verdict: "OUT_OF_SCOPE", required: false },
  ];
  const allKeep = tier1.every((r) => r.verdict === "KEEP");
  return { tier1, tier2, tier3, allKeep };
}
