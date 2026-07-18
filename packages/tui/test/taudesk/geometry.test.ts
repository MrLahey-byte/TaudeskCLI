import { expect, test } from "bun:test";
import { computePaneGeometry, TWO_PANE_MIN, THREE_PANE_MIN, CONTEXT_MIN, OBS_MIN, CONTROL_MIN } from "../../src/taudesk/geometry.ts";

test("geometry thresholds are derived from mins (R7)", () => {
  expect(TWO_PANE_MIN).toBe(CONTROL_MIN + OBS_MIN);
  expect(THREE_PANE_MIN).toBe(CONTEXT_MIN + CONTROL_MIN + OBS_MIN);
  expect(TWO_PANE_MIN).toBe(78);
  expect(THREE_PANE_MIN).toBe(106);
});

test("tier selection: stacked < 78, two-pane 78..105, three-pane >=106", () => {
  expect(computePaneGeometry(59).tier).toBe("stacked");
  expect(computePaneGeometry(72).tier).toBe("stacked");
  expect(computePaneGeometry(77).tier).toBe("stacked");
  expect(computePaneGeometry(78).tier).toBe("two-pane");
  expect(computePaneGeometry(99).tier).toBe("two-pane");
  expect(computePaneGeometry(105).tier).toBe("two-pane");
  expect(computePaneGeometry(106).tier).toBe("three-pane");
  expect(computePaneGeometry(180).tier).toBe("three-pane");
});

test("conservation ctx+ctl+obs === floor(total) at T7 NC widths (60,72,77,100,105) + R7 widths", () => {
  const widths = [60, 72, 77, 100, 105, 59, 78, 99, 106, 180];
  for (const w of widths) {
    const g = computePaneGeometry(w);
    const sum = g.context + g.control + g.observability;
    expect(sum).toBe(Math.floor(w));
  }
});

test("stacked has zero side panes", () => {
  const g = computePaneGeometry(60);
  expect(g.context).toBe(0);
  expect(g.observability).toBe(0);
  expect(g.control).toBe(60);
});

test("two-pane obs clamped 38..64, no max-clamp on control (T7)", () => {
  const g78 = computePaneGeometry(78);
  expect(g78.observability).toBeGreaterThanOrEqual(38);
  expect(g78.observability).toBeLessThanOrEqual(64);
  // control = total - obs, so at 78 it must be >=40 (CONTROL_MIN)
  expect(g78.control).toBeGreaterThanOrEqual(40);

  // At width 100, control must NOT be clamped to 40 — tier threshold IS the clamp
  const g100 = computePaneGeometry(100);
  expect(g100.control + g100.observability).toBe(100);
  // obs floor(0.3*100)=30 -> clamped to 38, control 62
  expect(g100.observability).toBe(38);
  expect(g100.control).toBe(62);
});
