export type CanonicalField = "name" | "website" | "industry" | "location" | "headcount";

export type ColumnMapping = Partial<Record<CanonicalField, string>>;

export interface ParsedRow {
  name: string;
  website?: string;
  industry?: string;
  location?: string;
  headcount?: string;
}

export const HEADER_SYNONYMS: Record<CanonicalField, string[]> = {
  name: ["name", "account", "accountname", "company", "companyname", "organization", "org"],
  website: ["website", "url", "domain", "site", "web", "homepage"],
  industry: ["industry", "sector", "vertical", "category"],
  location: ["location", "country", "hq", "headquarters", "region", "city", "geo"],
  headcount: [
    "headcount",
    "employees",
    "size",
    "companysize",
    "employeecount",
    "staff",
    "employeesize",
  ],
};

export const CANONICAL_FIELDS: CanonicalField[] = [
  "name",
  "website",
  "industry",
  "location",
  "headcount",
];

export const REQUIRED_FIELDS: CanonicalField[] = ["name"];

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface DetectResult {
  mapping: ColumnMapping;
  detected: string[];
  unmatched: string[];
  missingRequired: CanonicalField[];
}

export function detectColumns(headers: string[]): DetectResult {
  const mapping: ColumnMapping = {};
  const detected: string[] = [];
  const unmatched: string[] = [];

  const normalizedToOriginal = new Map<string, string>();
  for (const h of headers) {
    const n = normalizeHeader(h);
    if (n && !normalizedToOriginal.has(n)) normalizedToOriginal.set(n, h);
  }

  for (const field of CANONICAL_FIELDS) {
    for (const syn of HEADER_SYNONYMS[field]) {
      const original = normalizedToOriginal.get(syn);
      if (original && !mapping[field]) {
        mapping[field] = original;
        break;
      }
    }
  }

  const mapped = new Set(Object.values(mapping));
  for (const h of headers) {
    if (mapped.has(h)) detected.push(h);
    else unmatched.push(h);
  }

  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);

  return { mapping, detected, unmatched, missingRequired };
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return String(v).trim();
}

export function normalizeRows(
  rawRows: Record<string, unknown>[],
  mapping: ColumnMapping
): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const raw of rawRows) {
    const name = mapping.name ? cellToString(raw[mapping.name]) : "";
    if (!name) continue;
    const row: ParsedRow = { name };
    if (mapping.website) {
      const v = cellToString(raw[mapping.website]);
      if (v) row.website = v;
    }
    if (mapping.industry) {
      const v = cellToString(raw[mapping.industry]);
      if (v) row.industry = v;
    }
    if (mapping.location) {
      const v = cellToString(raw[mapping.location]);
      if (v) row.location = v;
    }
    if (mapping.headcount) {
      const v = cellToString(raw[mapping.headcount]);
      if (v) row.headcount = v;
    }
    out.push(row);
  }
  return out;
}
