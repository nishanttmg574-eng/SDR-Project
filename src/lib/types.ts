import type { AiProviderId, Stage, Tier } from "./config";
import { parseCustomFields, type CustomFields } from "./normalization";

export type { AiProviderId, Stage, Tier };

export const CHANNELS = [
  "call",
  "email",
  "linkedin",
  "whatsapp",
  "meeting",
  "other",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  call: "Call",
  email: "Email",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  meeting: "Meeting",
  other: "Other",
};

export const OUTCOMES = [
  "no-answer",
  "connected",
  "replied",
  "meeting",
  "objection",
  "dead",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  "no-answer": "No answer",
  connected: "Connected",
  replied: "Replied",
  meeting: "Meeting",
  objection: "Objection",
  dead: "Dead",
};

export type Confidence = "high" | "medium" | "low";

export interface AiSource {
  url: string;
  title: string | null;
  snippet: string | null;
  retrievedAt: string | null;
}

export interface AiEvidenceField {
  summary: string;
  sources: AiSource[];
}

export interface AiEvidence {
  funding: AiEvidenceField | null;
  countries: string[];
  countrySources: AiSource[];
  hiring: AiEvidenceField | null;
  entity_match: Confidence | null;
  entityMatchFlag: string | null;
}

export type AiErrorType = "provider" | "schema";

export interface AiMetadata {
  provider: AiProviderId;
  model: string;
  promptVersion: string;
  settingsHash: string;
  inputHash: string;
  toolConfig: Record<string, unknown>;
  providerRequestId: string | null;
  usage: Record<string, unknown> | null;
  generatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  headcount: string | null;
  customFields: CustomFields | null;
  stage: Stage;
  notes: string;
  aiTier: Tier | null;
  aiConfidence: Confidence | null;
  aiEvidence: AiEvidence | null;
  aiReasoning: string | null;
  aiGaps: string[];
  aiProposedAt: string | null;
  scoringError: string | null;
  scoringErrorType: AiErrorType | null;
  aiMetadata: AiMetadata | null;
  humanTier: Tier | null;
  humanVerifiedAt: string | null;
  followupDate: string | null;
  followupReason: string | null;
  callPrep: string | null;
  callPrepDate: string | null;
  callPrepMetadata: AiMetadata | null;
  lastActivityAt: string | null;
  interactionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccountRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  headcount: string | null;
  custom_fields: string | null;
  stage: Stage;
  notes: string;
  ai_tier: Tier | null;
  ai_confidence: Confidence | null;
  ai_evidence: string | null;
  ai_reasoning: string | null;
  ai_gaps: string | null;
  ai_proposed_at: string | null;
  scoring_error: string | null;
  scoring_error_type: AiErrorType | null;
  ai_metadata: string | null;
  human_tier: Tier | null;
  human_verified_at: string | null;
  followup_date: string | null;
  followup_reason: string | null;
  call_prep: string | null;
  call_prep_date: string | null;
  call_prep_metadata: string | null;
  last_activity_at: string | null;
  interaction_count?: number;
  created_at: string;
  updated_at: string;
}

function sanitizeSource(raw: unknown): AiSource | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const url = typeof obj.url === "string" ? obj.url.trim() : "";
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    url,
    title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : null,
    snippet:
      typeof obj.snippet === "string" && obj.snippet.trim()
        ? obj.snippet.trim()
        : null,
    retrievedAt:
      typeof obj.retrievedAt === "string" && obj.retrievedAt.trim()
        ? obj.retrievedAt.trim()
        : null,
  };
}

function sourcesFromLegacySource(value: unknown): AiSource[] {
  if (typeof value !== "string") return [];
  const url = value.trim();
  if (!/^https?:\/\//i.test(url)) return [];
  return [{ url, title: null, snippet: null, retrievedAt: null }];
}

function parseSources(raw: unknown): AiSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeSource).filter((source): source is AiSource => source !== null);
}

function parseEvidenceField(raw: unknown): AiEvidenceField | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const summary = typeof obj.summary === "string" ? obj.summary : "";
  const sources = parseSources(obj.sources);
  return {
    summary,
    sources: sources.length > 0 ? sources : sourcesFromLegacySource(obj.source),
  };
}

function parseEvidence(raw: string | null): AiEvidence | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    const record = obj as Record<string, unknown>;
    const countrySources = parseSources(record.countrySources);
    return {
      funding: parseEvidenceField(record.funding),
      countries: Array.isArray(record.countries)
        ? record.countries.filter((x): x is string => typeof x === "string")
        : [],
      countrySources,
      hiring: parseEvidenceField(record.hiring),
      entity_match:
        record.entity_match === "high" ||
        record.entity_match === "medium" ||
        record.entity_match === "low"
          ? record.entity_match
          : null,
      entityMatchFlag:
        typeof record.entityMatchFlag === "string" ? record.entityMatchFlag : null,
    };
  } catch {
    return null;
  }
}

function parseMetadata(raw: string | null): AiMetadata | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    const record = obj as Record<string, unknown>;
    const provider = record.provider;
    if (provider !== "openai" && provider !== "anthropic") return null;
    return {
      provider,
      model: typeof record.model === "string" ? record.model : "",
      promptVersion:
        typeof record.promptVersion === "string" ? record.promptVersion : "",
      settingsHash:
        typeof record.settingsHash === "string" ? record.settingsHash : "",
      inputHash: typeof record.inputHash === "string" ? record.inputHash : "",
      toolConfig:
        record.toolConfig && typeof record.toolConfig === "object" && !Array.isArray(record.toolConfig)
          ? (record.toolConfig as Record<string, unknown>)
          : {},
      providerRequestId:
        typeof record.providerRequestId === "string" ? record.providerRequestId : null,
      usage:
        record.usage && typeof record.usage === "object" && !Array.isArray(record.usage)
          ? (record.usage as Record<string, unknown>)
          : null,
      generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : "",
    };
  } catch {
    return null;
  }
}

function parseGaps(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    industry: row.industry,
    location: row.location,
    headcount: row.headcount,
    customFields: parseCustomFields(row.custom_fields),
    stage: row.stage,
    notes: row.notes,
    aiTier: row.ai_tier,
    aiConfidence: row.ai_confidence,
    aiEvidence: parseEvidence(row.ai_evidence),
    aiReasoning: row.ai_reasoning,
    aiGaps: parseGaps(row.ai_gaps),
    aiProposedAt: row.ai_proposed_at,
    scoringError: row.scoring_error,
    scoringErrorType: row.scoring_error_type,
    aiMetadata: parseMetadata(row.ai_metadata),
    humanTier: row.human_tier,
    humanVerifiedAt: row.human_verified_at,
    followupDate: row.followup_date,
    followupReason: row.followup_reason,
    callPrep: row.call_prep,
    callPrepDate: row.call_prep_date,
    callPrepMetadata: parseMetadata(row.call_prep_metadata),
    lastActivityAt: row.last_activity_at,
    interactionCount: row.interaction_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface Interaction {
  id: string;
  accountId: string;
  date: string;
  channel: Channel | null;
  person: string | null;
  outcome: Outcome | null;
  notes: string;
  nextStep: string | null;
  createdAt: string;
}

export interface InteractionRow {
  id: string;
  account_id: string;
  date: string;
  channel: Channel | null;
  person: string | null;
  outcome: Outcome | null;
  notes: string;
  next_step: string | null;
  created_at: string;
}

export function rowToInteraction(row: InteractionRow): Interaction {
  return {
    id: row.id,
    accountId: row.account_id,
    date: row.date,
    channel: row.channel,
    person: row.person,
    outcome: row.outcome,
    notes: row.notes,
    nextStep: row.next_step,
    createdAt: row.created_at,
  };
}

export interface Prospect {
  id: string;
  accountId: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  notes: string;
  createdAt: string;
}

export interface ProspectRow {
  id: string;
  account_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  notes: string;
  created_at: string;
}

export function rowToProspect(row: ProspectRow): Prospect {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    linkedin: row.linkedin,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export interface Settings {
  workspace: string;
  company: string;
  tier1Def: string;
  tiersDef: string;
  aiProvider: AiProviderId;
  model: string;
}

export interface NewAccountInput {
  name: string;
  website?: string;
  industry?: string;
  location?: string;
  headcount?: string;
  customFields?: CustomFields;
}

export interface AccountPatch {
  humanTier?: Tier | null;
  stage?: Stage;
  notes?: string;
}

export interface NewInteractionInput {
  date: string;
  channel?: Channel;
  person?: string;
  outcome?: Outcome;
  notes?: string;
  nextStep?: string;
}

export const INTERACTION_DISPOSITIONS = [
  "complete-clear",
  "no-answer-retry",
  "set-new-follow-up",
  "meeting-booked",
  "mark-dead",
] as const;
export type InteractionDispositionType =
  (typeof INTERACTION_DISPOSITIONS)[number];

export interface InteractionDispositionInput {
  type: InteractionDispositionType;
  followupDate?: string;
  followupReason?: string;
}

export interface NewProspectInput {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  notes?: string;
}

export type ProspectPatch = Partial<NewProspectInput>;

export interface FollowupPatch {
  date: string;
  reason: string;
}

export interface DashboardStats {
  total: number;
  followupsDue: number;
  followupsOverdue: number;
  followupsScheduled: number;
  touchesLoggedLast7Days: number;
  uniqueAccountsTouchedLast7Days: number;
  connectsAndRepliesLast7Days: number;
  meetingsBookedLast7Days: number;
  staleTier1And2Accounts: number;
  touchedLast7Days: number;
  needsReview: number;
}

export type MorningQueueBucketId =
  | "overdue-tier12-followups"
  | "today-tier12-followups"
  | "low-confidence-unverified"
  | "untouched-tier12"
  | "stale-active"
  | "upcoming-followups"
  | "everything-else";

export interface MorningQueueItem {
  account: Account;
  bucket: MorningQueueBucketId;
  bucketRank: number;
  effectiveTier: Tier | null;
  lastInteractionDate: string | null;
  reason: string;
}

export interface MorningQueueGroup {
  id: MorningQueueBucketId;
  label: string;
  description: string;
  total: number;
  items: MorningQueueItem[];
}

export interface FollowupRow {
  accountId: string;
  accountName: string;
  followupDate: string;
  followupReason: string | null;
  bucket: "overdue" | "today" | "upcoming";
}

export interface ListFilters {
  q?: string;
  tier?: Tier | "unscored";
  stage?: Stage;
  needsReview?: boolean;
  hasFollowup?: boolean;
  followupBucket?: "due" | "scheduled";
  touched?: boolean;
  staleTier12?: boolean;
}

export interface AccountListPage {
  accounts: Account[];
  totalCount: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
