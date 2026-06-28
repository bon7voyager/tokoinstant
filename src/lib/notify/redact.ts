/** Fully redact a secret in stored copies — no edge chars or length leaked, so a
 * reusable credential (e.g. a generated password) can't be cracked from the log. */
function mask(): string {
  return "[redacted]";
}

export function redactSecrets(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (!s) continue;
    out = out.split(s).join(mask());
  }
  return out;
}

export function redactPayload(
  data: Record<string, unknown>,
  secrets: string[],
): string {
  let json = JSON.stringify(data);
  for (const s of secrets) {
    if (!s) continue;
    json = json.split(s).join(mask());
  }
  return json;
}
