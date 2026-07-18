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
    return redactText(value) as T;
  }
  if (Array.isArray(value)) {
    const mapped = (value as unknown[]).map((item) => redactValue(item as T));
    return mapped as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const proto = Object.getPrototypeOf(objectValue);
    if (proto !== Object.prototype && proto !== null) return value;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(objectValue)) {
      output[key] = redactValue(nested as T);
    }
    return output as T;
  }
  return value;
}
