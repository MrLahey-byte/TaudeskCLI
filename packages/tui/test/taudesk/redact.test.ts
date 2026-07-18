import { expect, test } from "bun:test";
import { redactLine, redactText, redactValue, REDACTION_PATTERNS } from "../../src/taudesk/redact.ts";

test("redaction uses .replace() only (T8) — patterns have /g", () => {
  // verify patterns are global where needed
  expect(REDACTION_PATTERNS.awsAccessKey.flags).toContain("g");
});

test("redactLine replaces all 5 R1 patterns", () => {
  const cases = [
    { input: "key AKIAIOSFODNN7EXAMPLE1234 here", expectRedacted: true },
    { input: "api: sk-abcdefghijklmnopqrst", inputHas: "api", expectRedacted: true },
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
  // This repro places secrets at line start with trailing text longer than match — naive .test() on shared /g carries lastIndex
  const lines = [
    "AKIAIOSFODNN7EXAMPLE1234 is at start plus a lot of trailing text to exceed match length and expose lastIndex bug",
    "postgres://bob:secret@host/db plus trailing text longer than the uri match itself to trigger lastIndex skip",
    "normal line without secrets",
    "AKIAZZZZZZZZZZZZZZZZZZ at start again with long trailing text that ensures second occurrence would be missed by .test()",
  ];
  const combined = lines.join("\n");

  // Simulate buggy .test() loop on shared /g
  const shared = /AKIA[A-Z0-9]{16}/g;
  let missCount = 0;
  for (const line of lines) {
    // Note: intervening non-matches reset lastIndex in some engines? The trap requires placement at line START
    if (line.startsWith("AKIA")) {
      const isMatch = shared.test(line);
      if (!isMatch) missCount++;
    } else {
      // non-match does NOT necessarily reset — but in some impls it does; that's why secret-at-start matters
      shared.test(line);
    }
  }
  // At least 1 miss via .test() — this proves the bug exists with .test() on shared /g
  expect(missCount).toBeGreaterThanOrEqual(1);

  // .replace() never misses
  const out = redactText(combined);
  // Both AKIA lines must be redacted
  const redactedCount = (out.match(/\[REDACTED\]/g) || []).length;
  expect(redactedCount).toBeGreaterThanOrEqual(2);
  // Output should have 0 misses
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
