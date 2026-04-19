import type { Stage, Tier } from "./config";

export type { Stage, Tier };

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

export interface Account {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  headcount: string | null;
  stage: Stage;
  notes: string;
  aiTier: Tier | null;
  humanTier: Tier | null;
  humanVerifiedAt: string | null;
  followupDate: string | null;
  followupReason: string | null;
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
  stage: Stage;
  notes: string;
  ai_tier: Tier | null;
  human_tier: Tier | null;
  human_verified_at: string | null;
  followup_date: string | null;
  followup_reason: string | null;
  interaction_count?: number;
  created_at: string;
  updated_at: string;
}

export function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    industry: row.industry,
    location: row.location,
    headcount: row.headcount,
    stage: row.stage,
    notes: row.notes,
    aiTier: row.ai_tier,
    humanTier: row.human_tier,
    humanVerifiedAt: row.human_verified_at,
    followupDate: row.followup_date,
    followupReason: row.followup_reason,
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
  model: string;
}

export interface NewAccountInput {
  name: string;
  website?: string;
  industry?: string;
  location?: string;
  headcount?: string;
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
  touchedThisWeek: number;
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
  touched?: boolean;
}
