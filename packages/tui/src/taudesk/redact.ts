// redact.ts — pure secret redaction. Scope: agent-loop + tool-exec display/persist ONLY; PTY exempt by design.
// Domain: agent+tool data may contain keys; PTY live byte stream is not line-regex territory.
// R1 verbatim regex — must be exact; use .replace() ONLY for T8 (never .test/.exec on shared /g).

export const REDACTION_PATTERNS = {
  awsAccessKey: /AKIA[A-Z0-9]{16}/g,
  genericToken: /(?:api|token|key|secret)[\s:=]+[A-Za-z0-9/+]{20,}/gi,
  dbUrl: /(postgres|mysql|mongodb):\/\/.*?@/g,
  privateKey: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g,
  githubPat: /ghp_[A-Za-z0-9]{36}/g,
} as const;

const REPLACEMENT = "[REDACTED]";

// Executed call must be .replace() per trap T8
export function redactLine(line: string): string {
  let out = line;
  out = out.replace(REDACTION_PATTERNS.awsAccessKey, REPLACEMENT);
  out = out.replace(REDACTION_PATTERNS.genericToken, REPLACEMENT);
  out = out.replace(REDACTION_PATTERNS.dbUrl, REPLACEMENT);
  out = out.replace(REDACTION_PATTERNS.privateKey, REPLACEMENT);
  out = out.replace(REDACTION_PATTERNS.githubPat, REPLACEMENT);
  return out;
}

export function redactText(text: string): string {
  return text.split("\n").map(redactLine).join("\n");
}

export function redactValue<T>(value: T): T {
  if (typeof value === "string") {
    return redactText(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return (value.map((v) => redactValue(v)) as unknown) as T;
  }
  if (value !== null && typeof value === "object") {
    // plain objects only — don't traverse class instances arbitrarily
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(v);
    }
    return out as T;
  }
  return value;
}
