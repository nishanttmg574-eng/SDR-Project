import { z } from "zod";
import type { AiEvidence, AiEvidenceField, AiSource } from "./types";

const confidenceSchema = z.enum(["high", "medium", "low"]);

export const aiSourceSchema = z
  .object({
    url: z.string().url(),
    title: z.string().nullable(),
    snippet: z.string().nullable(),
    retrievedAt: z.string().nullable(),
  })
  .strict();

const evidenceFieldSchema = z
  .object({
    summary: z.string(),
    sources: z.array(aiSourceSchema).min(1),
  })
  .strict();

const countryEvidenceSchema = z
  .object({
    country: z.string(),
    sources: z.array(aiSourceSchema),
  })
  .strict();

export const scoringResponseSchema = z
  .object({
    proposedTier: z.enum(["1", "2", "3", "4"]),
    confidence: confidenceSchema,
    evidence: z
      .object({
        funding: evidenceFieldSchema.nullable(),
        countries: z.array(z.string()),
        countryEvidence: z.array(countryEvidenceSchema),
        hiring: evidenceFieldSchema.nullable(),
        entity_match: confidenceSchema,
      })
      .strict(),
    reasoning: z.string(),
    gaps: z.array(z.string()),
  })
  .strict();

export const callPrepResponseSchema = z
  .object({
    callOpener: z.string(),
    qualifyingQuestions: z.array(z.string()).min(3).max(3),
    valueBridge: z.string(),
    cta: z.string(),
    likelyObjectionAndHandler: z.string(),
    thinNotes: z.boolean(),
  })
  .strict();

export type ScoringResponse = z.infer<typeof scoringResponseSchema>;
export type CallPrepResponse = z.infer<typeof callPrepResponseSchema>;

export function buildEvidence(response: ScoringResponse): AiEvidence {
  const countrySources = response.evidence.countryEvidence.flatMap((item) =>
    item.sources.map((source) => ({
      ...source,
      title: source.title ?? item.country,
    }))
  );
  const entityMatchFlag =
    response.proposedTier === "1" && response.evidence.entity_match === "low"
      ? "Tier 1 proposal flagged because entity match is low."
      : null;

  return {
    funding: response.evidence.funding,
    countries: response.evidence.countries,
    countrySources,
    hiring: response.evidence.hiring,
    entity_match: response.evidence.entity_match,
    entityMatchFlag,
  };
}

export function hasRequiredEvidenceSources(evidence: AiEvidence): boolean {
  return (
    (!evidence.funding || evidence.funding.sources.length > 0) &&
    (!evidence.hiring || evidence.hiring.sources.length > 0)
  );
}

export function sourceToDisplay(source: AiSource): string {
  return source.title?.trim() || source.url;
}

export function evidenceFieldHasSources(field: AiEvidenceField | null): boolean {
  return !field || field.sources.length > 0;
}

export function formatCallPrep(response: CallPrepResponse): string {
  const suffix = response.thinNotes ? " (generic - thin notes)" : "";
  return [
    "CALL OPENER",
    `${response.callOpener}${suffix}`,
    "",
    "QUALIFYING QUESTIONS",
    ...response.qualifyingQuestions.map((question, index) => `${index + 1}. ${question}`),
    "",
    "VALUE BRIDGE",
    `${response.valueBridge}${suffix}`,
    "",
    "CTA",
    response.cta,
    "",
    "LIKELY OBJECTION + HANDLER",
    response.likelyObjectionAndHandler,
  ].join("\n");
}
