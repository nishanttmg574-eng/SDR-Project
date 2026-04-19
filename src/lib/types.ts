import type { Stage, Tier } from "./config";

export type { Stage, Tier };

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

export interface ListFilters {
  q?: string;
  tier?: Tier | "unscored";
  stage?: Stage;
  needsReview?: boolean;
  hasFollowup?: boolean;
}
