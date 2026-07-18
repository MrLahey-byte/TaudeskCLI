// geometry.ts — R7 derived thresholds, conservation law.
// tune: pane mins are product decisions; thresholds derived so tier IS the clamp.
export const CONTEXT_MIN = 28;
export const CONTEXT_MAX = 34;
export const OBS_MIN = 38;
export const OBS_MAX = 64;
export const CONTROL_MIN = 40;
// tune: derived — do not edit these independently
export const TWO_PANE_MIN = CONTROL_MIN + OBS_MIN; // 78
export const THREE_PANE_MIN = CONTEXT_MIN + CONTROL_MIN + OBS_MIN; // 106

export type Tier = "stacked" | "two-pane" | "three-pane";

export type PaneGeometry = {
  tier: Tier;
  context: number;
  control: number;
  observability: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function computePaneGeometry(total: number): PaneGeometry {
  const t = Math.floor(total);
  if (t < TWO_PANE_MIN) {
    return { tier: "stacked", context: 0, control: t, observability: 0 };
  }
  if (t < THREE_PANE_MIN) {
    const obs = clamp(Math.floor(t * 0.3), OBS_MIN, OBS_MAX);
    // No max-clamp on control — tier threshold IS minimum enforcement, so conservation holds.
    return { tier: "two-pane", context: 0, control: t - obs, observability: obs };
  }
  const ctx = clamp(Math.floor(t * 0.18), CONTEXT_MIN, CONTEXT_MAX);
  const obs = clamp(Math.floor(t * 0.3), OBS_MIN, OBS_MAX);
  return { tier: "three-pane", context: ctx, control: t - ctx - obs, observability: obs };
}
