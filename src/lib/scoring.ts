import {
  SCORE_PROMPT_VERSION,
  SCORE_TOOL_CONFIG,
  buildAiMetadata,
  scoreInputHash,
} from "./ai-metadata";
import {
  AiProviderRequestError,
  AiSchemaValidationError,
} from "./ai-errors";
import { buildEvidence, hasRequiredEvidenceSources } from "./ai-schemas";
import { getProvider } from "./ai-providers";
import type { Account, AiEvidence, AiMetadata, Confidence, Settings } from "./types";
import type { Tier } from "./config";

export type ScoringOutcome =
  | {
      ok: true;
      tier: Tier;
      confidence: Confidence;
      evidence: AiEvidence;
      reasoning: string;
      gaps: string[];
      proposedAt: string;
      metadata: AiMetadata;
    }
  | {
      ok: false;
      error: string;
      errorType: "provider" | "schema";
      rawResponse: string | null;
      transient?: boolean;
      retryAfterMs?: number | null;
    };

const TIMEOUT_MS = 180_000;

function buildSystem(settings: Settings): string {
  const company = settings.company.trim() || "(not configured - ask the user to fill Settings)";
  const tier1 = settings.tier1Def.trim() || "(not configured)";
  const tiers = settings.tiersDef.trim() || "(not configured)";
  return `You score target accounts for this company:
${company}

Tier 1 (best-fit) definition:
${tier1}

Other tier definitions (Tier 2, 3, 4):
${tiers}

Research rules:
- Run at most 2 web searches. Prefer the account's own website and well-known funding, jobs, and press sources.
- Return source objects for evidence with url, title, snippet, and retrievedAt.
- Funding and hiring evidence must include at least one source when those fields are present.
- Countries can be unsourced, but if you have sources for country evidence, include them in countryEvidence.
- Downgrade or clearly flag Tier 1 proposals when entity_match is low.

Respond only with a JSON object matching this shape:
{
  "proposedTier": "1" | "2" | "3" | "4",
  "confidence": "high" | "medium" | "low",
  "evidence": {
    "funding": { "summary": string, "sources": [{ "url": string, "title": string | null, "snippet": string | null, "retrievedAt": string | null }] } | null,
    "countries": string[],
    "countryEvidence": [{ "country": string, "sources": [{ "url": string, "title": string | null, "snippet": string | null, "retrievedAt": string | null }] }],
    "hiring": { "summary": string, "sources": [{ "url": string, "title": string | null, "snippet": string | null, "retrievedAt": string | null }] } | null,
    "entity_match": "high" | "medium" | "low"
  },
  "reasoning": string,
  "gaps": string[]
}

"entity_match" is your confidence that you found the right company, not a namesake. Keep reasoning to two sentences maximum.`;
}

function buildUser(account: Account): string {
  const lines: string[] = [];
  lines.push(`Account: ${account.name}`);
  if (account.website) lines.push(`Website: ${account.website}`);
  if (account.industry) lines.push(`Industry hint: ${account.industry}`);
  if (account.location) lines.push(`Location hint: ${account.location}`);
  if (account.headcount) lines.push(`Known headcount: ${account.headcount}`);
  if (account.customFields) {
    lines.push("Imported spreadsheet fields:");
    for (const [key, value] of Object.entries(account.customFields)) {
      lines.push(`- ${key}: ${value}`);
    }
  }
  return lines.join("\n");
}

function withTimeout(parentSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

function failureFromError(error: unknown, controllerSignal: AbortSignal): Exclude<ScoringOutcome, { ok: true }> {
  if (error instanceof AiSchemaValidationError) {
    return {
      ok: false,
      error: error.message,
      errorType: "schema",
      rawResponse: error.rawResponse,
    };
  }
  if (error instanceof AiProviderRequestError) {
    return {
      ok: false,
      error: error.message,
      errorType: "provider",
      rawResponse: error.rawResponse,
      transient: error.transient,
      retryAfterMs: error.retryAfterMs,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    error: controllerSignal.aborted
      ? `Timeout or cancelled (${TIMEOUT_MS}ms budget)`
      : message,
    errorType: "provider",
    rawResponse: null,
    transient: controllerSignal.aborted,
  };
}

export async function scoreAccount(
  account: Account,
  settings: Settings,
  opts: { signal?: AbortSignal } = {}
): Promise<ScoringOutcome> {
  const timeout = withTimeout(opts.signal);
  const provider = getProvider(settings.aiProvider);
  const inputHash = scoreInputHash(account);

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await provider.score({
          settings,
          system: buildSystem(settings),
          user: buildUser(account),
          signal: timeout.signal,
        });
        const evidence = buildEvidence(result.value);
        if (!hasRequiredEvidenceSources(evidence)) {
          throw new AiSchemaValidationError(
            "Funding and hiring evidence must include sources when present",
            result.rawResponse
          );
        }
        return {
          ok: true,
          tier: result.value.proposedTier,
          confidence: result.value.confidence,
          evidence,
          reasoning: result.value.reasoning,
          gaps: result.value.gaps,
          proposedAt: new Date().toISOString(),
          metadata: buildAiMetadata({
            settings,
            promptVersion: SCORE_PROMPT_VERSION,
            inputHash,
            toolConfig: SCORE_TOOL_CONFIG,
            providerRequestId: result.providerRequestId,
            usage: result.usage,
          }),
        };
      } catch (error) {
        if (error instanceof AiSchemaValidationError && attempt === 0) {
          continue;
        }
        throw error;
      }
    }
    return {
      ok: false,
      error: "Schema validation failed after retry",
      errorType: "schema",
      rawResponse: null,
    };
  } catch (error) {
    return failureFromError(error, timeout.signal);
  } finally {
    timeout.cleanup();
  }
}
