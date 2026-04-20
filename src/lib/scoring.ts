import type { Account, AiEvidence, Confidence, Settings } from "./types";
import type { Tier } from "./config";
import { getClient } from "./anthropic";

export type ScoringOutcome =
  | {
      ok: true;
      tier: Tier;
      confidence: Confidence;
      evidence: AiEvidence;
      reasoning: string;
      gaps: string[];
      proposedAt: string;
    }
  | { ok: false; error: string; rawResponse: string | null };

const TIMEOUT_MS = 180_000;

function buildSystem(settings: Settings): string {
  const company = settings.company.trim() || "(not configured — ask the user to fill Settings)";
  const tier1 = settings.tier1Def.trim() || "(not configured)";
  const tiers = settings.tiersDef.trim() || "(not configured)";
  return `You score target accounts for this company:
${company}

Tier 1 (best-fit) definition:
${tier1}

Other tier definitions (Tier 2, 3, 4):
${tiers}

Research rules:
- Run at most 2 web searches. Prefer the account's own website and well-known funding / press sources.
- Cite sources by returning their URLs inline in the JSON fields below.

Respond with ONLY a JSON object on your final message — no prose, no markdown fences — matching this schema exactly:

{
  "proposedTier": "1" | "2" | "3" | "4",
  "confidence": "high" | "medium" | "low",
  "evidence": {
    "funding":  { "summary": string, "source": string | null } | null,
    "countries": string[],
    "hiring":   { "summary": string, "source": string | null } | null,
    "entity_match": "high" | "medium" | "low"
  },
  "reasoning": string,
  "gaps": string[]
}

"entity_match" is your confidence that you actually found the right company (not a namesake).
"reasoning" is two sentences maximum.
"gaps" is a list of what you couldn't verify.`;
}

function buildUser(account: Account): string {
  const lines: string[] = [];
  lines.push(`Account: ${account.name}`);
  if (account.website) lines.push(`Website: ${account.website}`);
  if (account.industry) lines.push(`Industry hint: ${account.industry}`);
  if (account.location) lines.push(`Location hint: ${account.location}`);
  if (account.headcount) lines.push(`Known headcount: ${account.headcount}`);
  return lines.join("\n");
}

function stripFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "");
    t = t.replace(/```\s*$/, "");
  }
  return t.trim();
}

function pickLastText(content: unknown[]): string | null {
  for (let i = content.length - 1; i >= 0; i--) {
    const block = content[i] as { type?: string; text?: string };
    if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
      return block.text;
    }
  }
  return null;
}

function validTier(v: unknown): v is Tier {
  return v === "1" || v === "2" || v === "3" || v === "4";
}

function validConfidence(v: unknown): v is Confidence {
  return v === "high" || v === "medium" || v === "low";
}

function sanitizeUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return /^https?:\/\//i.test(t) ? t : null;
}

function sanitizeEvidence(raw: unknown): AiEvidence | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pickPart = (p: unknown) => {
    if (!p || typeof p !== "object") return null;
    const obj = p as Record<string, unknown>;
    const summary = typeof obj.summary === "string" ? obj.summary : "";
    return { summary, source: sanitizeUrl(obj.source) };
  };
  const countries = Array.isArray(r.countries)
    ? r.countries.filter((c): c is string => typeof c === "string")
    : [];
  return {
    funding: pickPart(r.funding),
    countries,
    hiring: pickPart(r.hiring),
    entity_match: validConfidence(r.entity_match) ? r.entity_match : null,
  };
}

export async function scoreAccount(
  account: Account,
  settings: Settings,
  opts: { signal?: AbortSignal } = {}
): Promise<ScoringOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // Respect parent-supplied signal (e.g. bulk cancel)
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let rawText: string | null = null;
  try {
    const client = getClient();
    const response = await client.messages.create(
      {
        model: settings.model,
        max_tokens: 2048,
        system: buildSystem(settings),
        tools: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { type: "web_search_20250305", name: "web_search", max_uses: 2 } as any,
        ],
        messages: [{ role: "user", content: buildUser(account) }],
      },
      { signal: controller.signal }
    );

    const content = Array.isArray(response.content) ? response.content : [];
    rawText = pickLastText(content as unknown[]);
    if (!rawText) {
      return {
        ok: false,
        error: "Model returned no text block",
        rawResponse: JSON.stringify(content).slice(0, 4000),
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(rawText));
    } catch {
      return { ok: false, error: "JSON parse failed", rawResponse: rawText };
    }

    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "Response was not a JSON object", rawResponse: rawText };
    }
    const p = parsed as Record<string, unknown>;
    if (!validTier(p.proposedTier)) {
      return { ok: false, error: `Invalid proposedTier: ${String(p.proposedTier)}`, rawResponse: rawText };
    }
    if (!validConfidence(p.confidence)) {
      return { ok: false, error: `Invalid confidence: ${String(p.confidence)}`, rawResponse: rawText };
    }
    const evidence = sanitizeEvidence(p.evidence);
    if (!evidence) {
      return { ok: false, error: "Missing or invalid evidence object", rawResponse: rawText };
    }
    const reasoning = typeof p.reasoning === "string" ? p.reasoning : "";
    const gaps = Array.isArray(p.gaps)
      ? p.gaps.filter((g): g is string => typeof g === "string")
      : [];

    return {
      ok: true,
      tier: p.proposedTier,
      confidence: p.confidence,
      evidence,
      reasoning,
      gaps,
      proposedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (controller.signal.aborted) {
      return { ok: false, error: `Timeout or cancelled (${TIMEOUT_MS}ms budget)`, rawResponse: rawText };
    }
    return { ok: false, error: message, rawResponse: rawText };
  } finally {
    clearTimeout(timer);
  }
}
