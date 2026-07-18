import { expect, test } from "bun:test";
import { redactLine, redactText, redactValue, REDACTION_PATTERNS } from "../../src/taudesk/redact.ts";

test("redaction uses .replace() only (T8) — patterns have /g", () => {
  expect(REDACTION_PATTERNS.awsAccessKey.flags).toContain("g");
});

test("redactLine replaces all 5 R1 patterns", () => {
  const cases = [
    { input: "key AKIAIOSFODNN7EXAMPLE1234 here", expectRedacted: true },
    { input: "api: ABCDEFGHIJKLMNOPQRSTUVWX and more", expectRedacted: true }, // 24 alnum, no hyphen (R1 /[A-Za-z0-9/+]{20,}/)
    { input: "postgres://user:pass@localhost/db", expectRedacted: true },
    { input: "-----BEGIN RSA PRIVATE KEY-----", expectRedacted: true },
    { input: "token ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA here", expectRedacted: true },
  ];
  for (const c of cases) {
    const out = redactLine(c.input);
    expect(out).toContain("[REDACTED]");
    expect(out).not.toBe(c.input);
  }
});

test("T8 repro: secrets at line START with trailing text longer than match — .test() misses but .replace() does not", () => {
  // MUST place secrets at line START with trailing text longer than match — naive repro false-passes because intervening non-matches reset lastIndex
  // So we place two consecutive AKIA lines at start (no intervening reset) to guarantee lastIndex carryover miss
  const lines = [
    "AKIAIOSFODNN7EXAMPLE1234 is at start plus a lot of trailing text to exceed match length and expose lastIndex bug",
    "AKIAZZZZZZZZZZZZZZZZZZ at start again with long trailing text that ensures second occurrence would be missed by .test()",
    "normal line without secrets",
    "some more normal text",
  ];
  const combined = lines.join("\n");

  // Simulate buggy .test() loop on shared /g — consecutive secrets at start
  const shared = /AKIA[A-Z0-9]{16}/g;
  let missCount = 0;
  for (const line of lines) {
    if (line.startsWith("AKIA")) {
      const isMatch = shared.test(line);
      if (!isMatch) missCount++;
    } else {
      shared.test(line);
    }
  }
  // At least 1 miss via .test() — proves bug
  expect(missCount).toBeGreaterThanOrEqual(1);

  // .replace() never misses
  const out = redactText(combined);
  const redactedCount = (out.match(/\[REDACTED\]/g) || []).length;
  expect(redactedCount).toBeGreaterThanOrEqual(2);
  expect(out).not.toContain("AKIAIOSFODNN7EXAMPLE1234");
  expect(out).not.toContain("AKIAZZZZZZZZZZZZZZZZZZ");
});

test("redactValue recurses strings/arrays/plain objects", () => {
  const input = {
    a: "AKIAIOSFODNN7EXAMPLE1234",
    b: ["postgres://x@y/", "safe"],
    c: { nested: "ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
  };
  const out = redactValue(input);
  expect(out.a).toContain("[REDACTED]");
  expect(out.b[0]).toContain("[REDACTED]");
  expect(out.b[1]).toBe("safe");
  expect(out.c.nested).toContain("[REDACTED]");
});
