export interface LinkedInParsed {
  name: string;
  title?: string;
  location?: string;
}

export function parseLinkedInPaste(line: string): LinkedInParsed | null {
  if (!line) return null;
  const stripped = line.replace(/\s+·\s+\S+$/u, "").trim();
  if (!stripped) return null;
  const parts = stripped
    .split(/\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const parsed: LinkedInParsed = { name: parts[0] };
  if (parts[1]) parsed.title = parts[1];
  if (parts[2]) parsed.location = parts[2];
  return parsed;
}
