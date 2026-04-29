import { createHash } from "node:crypto";
import type {
  Account,
  AiMetadata,
  Interaction,
  Prospect,
  Settings,
} from "./types";

export const SCORE_PROMPT_VERSION = "score-v2";
export const CALL_PREP_PROMPT_VERSION = "call-prep-v2";

export const SCORE_TOOL_CONFIG = {
  webSearch: true,
  maxSearches: 2,
} as const;

export const CALL_PREP_TOOL_CONFIG = {
  webSearch: false,
} as const;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item)])
  );
}

export function hashObject(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}

export function settingsHash(settings: Settings, promptVersion: string): string {
  return hashObject({
    provider: settings.aiProvider,
    model: settings.model,
    company: settings.company,
    tier1Def: settings.tier1Def,
    tiersDef: settings.tiersDef,
    promptVersion,
  });
}

export function scoreInputHash(account: Account): string {
  return hashObject({
    name: account.name,
    website: account.website,
    industry: account.industry,
    location: account.location,
    headcount: account.headcount,
    customFields: account.customFields,
  });
}

export function callPrepInputHash(
  account: Account,
  interactions: Interaction[],
  prospects: Prospect[]
): string {
  return hashObject({
    account: {
      name: account.name,
      industry: account.industry,
      location: account.location,
      notes: account.notes,
      tier: account.humanTier ?? account.aiTier,
      aiEvidence: account.aiEvidence,
      aiProposedAt: account.aiProposedAt,
    },
    interactions: interactions.slice(0, 3).map((interaction) => ({
      date: interaction.date,
      channel: interaction.channel,
      person: interaction.person,
      outcome: interaction.outcome,
      notes: interaction.notes,
      nextStep: interaction.nextStep,
    })),
    prospects: prospects.map((prospect) => ({
      name: prospect.name,
      title: prospect.title,
      email: prospect.email,
      phone: prospect.phone,
      linkedin: prospect.linkedin,
      notes: prospect.notes,
    })),
  });
}

export function buildAiMetadata(args: {
  settings: Settings;
  promptVersion: string;
  inputHash: string;
  toolConfig: Record<string, unknown>;
  providerRequestId: string | null;
  usage: Record<string, unknown> | null;
}): AiMetadata {
  return {
    provider: args.settings.aiProvider,
    model: args.settings.model,
    promptVersion: args.promptVersion,
    settingsHash: settingsHash(args.settings, args.promptVersion),
    inputHash: args.inputHash,
    toolConfig: args.toolConfig,
    providerRequestId: args.providerRequestId,
    usage: args.usage,
    generatedAt: new Date().toISOString(),
  };
}

function metadataMatches(
  metadata: AiMetadata | null,
  settings: Settings,
  promptVersion: string,
  inputHash: string
): boolean {
  return (
    !!metadata &&
    metadata.provider === settings.aiProvider &&
    metadata.model === settings.model &&
    metadata.promptVersion === promptVersion &&
    metadata.settingsHash === settingsHash(settings, promptVersion) &&
    metadata.inputHash === inputHash
  );
}

export function isScoreStale(account: Account, settings: Settings): boolean {
  if (!account.aiTier && !account.scoringError) return false;
  return !metadataMatches(
    account.aiMetadata,
    settings,
    SCORE_PROMPT_VERSION,
    scoreInputHash(account)
  );
}

export function isCallPrepStale(
  account: Account,
  settings: Settings,
  interactions: Interaction[],
  prospects: Prospect[]
): boolean {
  if (!account.callPrep) return false;
  return !metadataMatches(
    account.callPrepMetadata,
    settings,
    CALL_PREP_PROMPT_VERSION,
    callPrepInputHash(account, interactions, prospects)
  );
}
