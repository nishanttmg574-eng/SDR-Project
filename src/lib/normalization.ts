const LEGAL_SUFFIXES = new Set([
  "ag",
  "bv",
  "co",
  "company",
  "corp",
  "corporation",
  "gmbh",
  "inc",
  "incorporated",
  "limited",
  "llc",
  "ltd",
  "oy",
  "plc",
  "pty",
  "sa",
  "sas",
]);

export type CustomFields = Record<string, string>;

export function normalizeAccountName(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) {
    words.pop();
  }

  return words.join(" ");
}

export function normalizeWebsiteDomain(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function normalizeCustomFields(
  value: Record<string, unknown> | null | undefined
): CustomFields | null {
  if (!value) return null;
  const out: CustomFields = {};
  for (const [key, raw] of Object.entries(value)) {
    const cleanKey = key.trim();
    if (!cleanKey) continue;
    if (raw === null || raw === undefined) continue;
    const cleanValue =
      typeof raw === "string" ? raw.trim() : String(raw).trim();
    if (cleanValue) out[cleanKey] = cleanValue;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function serializeCustomFields(
  value: Record<string, unknown> | null | undefined
): string | null {
  const normalized = normalizeCustomFields(value);
  return normalized ? JSON.stringify(normalized) : null;
}

export function parseCustomFields(raw: string | null): CustomFields | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeCustomFields(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}
