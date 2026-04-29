import { db } from "./db";
import { assertDateOnly } from "./dates";
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENAI_MODEL,
  STAGES,
  TIERS,
  isAiProviderId,
  modelLooksOpenAi,
} from "./config";
import { CHANNELS, OUTCOMES } from "./types";
import {
  normalizeAccountName,
  normalizeWebsiteDomain,
  serializeCustomFields,
} from "./normalization";

const ACCOUNT_COLUMNS = [
  "id",
  "name",
  "website",
  "industry",
  "location",
  "headcount",
  "custom_fields",
  "normalized_name",
  "website_domain",
  "stage",
  "notes",
  "ai_tier",
  "ai_confidence",
  "ai_evidence",
  "ai_reasoning",
  "ai_gaps",
  "ai_proposed_at",
  "scoring_error",
  "scoring_error_type",
  "ai_metadata",
  "human_tier",
  "human_verified_at",
  "followup_date",
  "followup_reason",
  "followup_set_at",
  "call_prep",
  "call_prep_date",
  "call_prep_metadata",
  "last_activity_at",
  "created_at",
  "updated_at",
] as const;

const INTERACTION_COLUMNS = [
  "id",
  "account_id",
  "date",
  "channel",
  "person",
  "outcome",
  "notes",
  "next_step",
  "created_at",
] as const;

const PROSPECT_COLUMNS = [
  "id",
  "account_id",
  "name",
  "title",
  "email",
  "phone",
  "linkedin",
  "notes",
  "created_at",
] as const;

const SETTINGS_COLUMNS = [
  "workspace",
  "company",
  "tier1_def",
  "tiers_def",
  "ai_provider",
  "model",
] as const;

export interface BackupSettings {
  workspace: string;
  company: string;
  tier1_def: string;
  tiers_def: string;
  ai_provider: "openai" | "anthropic";
  model: string;
}

export interface BackupV1 {
  version: 1;
  exportedAt: string;
  settings: Omit<BackupSettings, "ai_provider"> & { ai_provider?: "openai" | "anthropic" };
  accounts: Record<string, unknown>[];
  interactions: Record<string, unknown>[];
  prospects: Record<string, unknown>[];
}

export interface BackupV2 {
  version: 2;
  exportedAt: string;
  settings: BackupSettings;
  accounts: Record<string, unknown>[];
  interactions: Record<string, unknown>[];
  prospects: Record<string, unknown>[];
}

export type BackupPayload = BackupV1 | BackupV2;

export function getBackup(): BackupV2 {
  const accounts = db
    .prepare(`SELECT ${ACCOUNT_COLUMNS.join(", ")} FROM accounts ORDER BY created_at ASC`)
    .all() as Record<string, unknown>[];
  const interactions = db
    .prepare(`SELECT ${INTERACTION_COLUMNS.join(", ")} FROM interactions ORDER BY created_at ASC`)
    .all() as Record<string, unknown>[];
  const prospects = db
    .prepare(`SELECT ${PROSPECT_COLUMNS.join(", ")} FROM prospects ORDER BY created_at ASC`)
    .all() as Record<string, unknown>[];
  const settings = db
    .prepare(`SELECT ${SETTINGS_COLUMNS.join(", ")} FROM settings WHERE id = 1`)
    .get() as BackupSettings;

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    accounts,
    interactions,
    prospects,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pick(
  row: Record<string, unknown>,
  columns: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    out[col] = row[col] ?? null;
  }
  return out;
}

function requiredString(
  row: Record<string, unknown>,
  key: string,
  label: string
): string {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function stringField(
  row: Record<string, unknown>,
  key: string,
  label: string,
  fallback = ""
): string {
  const value = row[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function nullableString(
  row: Record<string, unknown>,
  key: string,
  label: string
): string | null {
  const value = row[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string or null`);
  }
  return value;
}

function validateNullableDateOnly(value: unknown, label: string): void {
  if (value === null || value === undefined) return;
  if (typeof value !== "string") {
    throw new Error(`${label} must be a valid date (YYYY-MM-DD)`);
  }
  assertDateOnly(value, label);
}

function validateNullableIso(value: unknown, label: string): void {
  if (value === null || value === undefined) return;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid ISO timestamp`);
  }
}

function validateJsonObjectText(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${label} must be JSON text or null`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} must contain valid JSON`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
}

function validateErrorType(value: unknown, label: string): "provider" | "schema" | null {
  if (value === null || value === undefined || value === "") return null;
  if (value === "provider" || value === "schema") return value;
  throw new Error(`${label} must be provider, schema, or null`);
}

function validateJsonStringArrayText(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${label} must be JSON text or null`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} must contain valid JSON`);
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a JSON array of strings`);
  }
  return value;
}

function validateCustomFields(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${label} must be JSON text or null`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} must contain valid JSON`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  for (const [key, item] of Object.entries(parsed)) {
    if (!key.trim() || typeof item !== "string") {
      throw new Error(`${label} must be a JSON object of string fields`);
    }
  }
  return serializeCustomFields(parsed);
}

function validateUniqueIds(rows: Record<string, unknown>[], label: string): Set<string> {
  const ids = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const id = requiredString(row, "id", `${label} ${index + 1} id`);
    if (ids.has(id)) {
      throw new Error(`Duplicate ${label} id in backup: ${id}`);
    }
    ids.add(id);
  }
  return ids;
}

function sanitizeSettings(row: Record<string, unknown>): BackupSettings {
  const rawModel = stringField(row, "model", "Settings model");
  const fallbackProvider = modelLooksOpenAi(rawModel) ? "openai" : "anthropic";
  const aiProviderRaw = row.ai_provider;
  const aiProvider = isAiProviderId(aiProviderRaw) ? aiProviderRaw : fallbackProvider;
  return {
    workspace: stringField(row, "workspace", "Settings workspace", "Account Workspace"),
    company: stringField(row, "company", "Settings company"),
    tier1_def: stringField(row, "tier1_def", "Settings tier1_def"),
    tiers_def: stringField(row, "tiers_def", "Settings tiers_def"),
    ai_provider: aiProvider,
    model:
      rawModel ||
      (aiProvider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL),
  };
}

function sanitizeAccount(row: Record<string, unknown>, index: number): Record<string, unknown> {
  const label = `Account ${index + 1}`;
  const name = requiredString(row, "name", `${label} name`);
  const website = nullableString(row, "website", `${label} website`);
  const stage = stringField(row, "stage", `${label} stage`, "new");
  if (!(STAGES as readonly string[]).includes(stage)) {
    throw new Error(`${label} stage is invalid: ${stage}`);
  }
  const aiTier = nullableString(row, "ai_tier", `${label} ai_tier`);
  if (aiTier && !(TIERS as readonly string[]).includes(aiTier)) {
    throw new Error(`${label} ai_tier is invalid: ${aiTier}`);
  }
  const humanTier = nullableString(row, "human_tier", `${label} human_tier`);
  if (humanTier && !(TIERS as readonly string[]).includes(humanTier)) {
    throw new Error(`${label} human_tier is invalid: ${humanTier}`);
  }
  const confidence = nullableString(row, "ai_confidence", `${label} ai_confidence`);
  if (confidence && !["high", "medium", "low"].includes(confidence)) {
    throw new Error(`${label} ai_confidence is invalid: ${confidence}`);
  }

  validateNullableDateOnly(row.followup_date, `${label} followup_date`);
  validateNullableIso(row.ai_proposed_at, `${label} ai_proposed_at`);
  validateNullableIso(row.human_verified_at, `${label} human_verified_at`);
  validateNullableIso(row.followup_set_at, `${label} followup_set_at`);
  validateNullableIso(row.call_prep_date, `${label} call_prep_date`);
  validateNullableIso(row.last_activity_at, `${label} last_activity_at`);
  validateNullableIso(row.created_at, `${label} created_at`);
  validateNullableIso(row.updated_at, `${label} updated_at`);

  return {
    id: requiredString(row, "id", `${label} id`),
    name,
    website,
    industry: nullableString(row, "industry", `${label} industry`),
    location: nullableString(row, "location", `${label} location`),
    headcount: nullableString(row, "headcount", `${label} headcount`),
    custom_fields: validateCustomFields(row.custom_fields, `${label} custom_fields`),
    normalized_name:
      nullableString(row, "normalized_name", `${label} normalized_name`) ??
      normalizeAccountName(name),
    website_domain:
      nullableString(row, "website_domain", `${label} website_domain`) ??
      normalizeWebsiteDomain(website),
    stage,
    notes: stringField(row, "notes", `${label} notes`),
    ai_tier: aiTier,
    ai_confidence: confidence,
    ai_evidence: validateJsonObjectText(row.ai_evidence, `${label} ai_evidence`),
    ai_reasoning: nullableString(row, "ai_reasoning", `${label} ai_reasoning`),
    ai_gaps: validateJsonStringArrayText(row.ai_gaps, `${label} ai_gaps`),
    ai_proposed_at: nullableString(row, "ai_proposed_at", `${label} ai_proposed_at`),
    scoring_error: nullableString(row, "scoring_error", `${label} scoring_error`),
    scoring_error_type: validateErrorType(
      row.scoring_error_type,
      `${label} scoring_error_type`
    ),
    ai_metadata: validateJsonObjectText(row.ai_metadata, `${label} ai_metadata`),
    human_tier: humanTier,
    human_verified_at: nullableString(
      row,
      "human_verified_at",
      `${label} human_verified_at`
    ),
    followup_date: nullableString(row, "followup_date", `${label} followup_date`),
    followup_reason: nullableString(row, "followup_reason", `${label} followup_reason`),
    followup_set_at: nullableString(row, "followup_set_at", `${label} followup_set_at`),
    call_prep: nullableString(row, "call_prep", `${label} call_prep`),
    call_prep_date: nullableString(row, "call_prep_date", `${label} call_prep_date`),
    call_prep_metadata: validateJsonObjectText(
      row.call_prep_metadata,
      `${label} call_prep_metadata`
    ),
    last_activity_at: nullableString(row, "last_activity_at", `${label} last_activity_at`),
    created_at: stringField(row, "created_at", `${label} created_at`, new Date().toISOString()),
    updated_at: stringField(row, "updated_at", `${label} updated_at`, new Date().toISOString()),
  };
}

function sanitizeInteraction(
  row: Record<string, unknown>,
  index: number,
  accountIds: Set<string>
): Record<string, unknown> {
  const label = `Interaction ${index + 1}`;
  const accountId = requiredString(row, "account_id", `${label} account_id`);
  if (!accountIds.has(accountId)) {
    throw new Error(`${label} references missing account_id: ${accountId}`);
  }
  const date = requiredString(row, "date", `${label} date`);
  assertDateOnly(date, "Interaction date");
  const channel = nullableString(row, "channel", `${label} channel`);
  if (channel && !(CHANNELS as readonly string[]).includes(channel)) {
    throw new Error(`${label} channel is invalid: ${channel}`);
  }
  const outcome = nullableString(row, "outcome", `${label} outcome`);
  if (outcome && !(OUTCOMES as readonly string[]).includes(outcome)) {
    throw new Error(`${label} outcome is invalid: ${outcome}`);
  }
  validateNullableIso(row.created_at, `${label} created_at`);

  return {
    id: requiredString(row, "id", `${label} id`),
    account_id: accountId,
    date,
    channel,
    person: nullableString(row, "person", `${label} person`),
    outcome,
    notes: stringField(row, "notes", `${label} notes`),
    next_step: nullableString(row, "next_step", `${label} next_step`),
    created_at: stringField(row, "created_at", `${label} created_at`, new Date().toISOString()),
  };
}

function sanitizeProspect(
  row: Record<string, unknown>,
  index: number,
  accountIds: Set<string>
): Record<string, unknown> {
  const label = `Prospect ${index + 1}`;
  const accountId = requiredString(row, "account_id", `${label} account_id`);
  if (!accountIds.has(accountId)) {
    throw new Error(`${label} references missing account_id: ${accountId}`);
  }
  validateNullableIso(row.created_at, `${label} created_at`);

  return {
    id: requiredString(row, "id", `${label} id`),
    account_id: accountId,
    name: requiredString(row, "name", `${label} name`),
    title: nullableString(row, "title", `${label} title`),
    email: nullableString(row, "email", `${label} email`),
    phone: nullableString(row, "phone", `${label} phone`),
    linkedin: nullableString(row, "linkedin", `${label} linkedin`),
    notes: stringField(row, "notes", `${label} notes`),
    created_at: stringField(row, "created_at", `${label} created_at`, new Date().toISOString()),
  };
}

function asRecordArray(value: unknown[], label: string): Record<string, unknown>[] {
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`${label} ${index + 1} must be an object`);
    }
    return item;
  });
}

export function restoreBackup(payload: unknown): {
  accounts: number;
  interactions: number;
  prospects: number;
} {
  if (!isRecord(payload)) {
    throw new Error("Backup must be a JSON object");
  }
  if (payload.version !== 1 && payload.version !== 2) {
    throw new Error(`Unsupported backup version: ${String(payload.version)}`);
  }
  if (!isRecord(payload.settings)) {
    throw new Error("Backup is missing 'settings' object");
  }
  if (!Array.isArray(payload.accounts)) {
    throw new Error("Backup is missing 'accounts' array");
  }
  if (!Array.isArray(payload.interactions)) {
    throw new Error("Backup is missing 'interactions' array");
  }
  if (!Array.isArray(payload.prospects)) {
    throw new Error("Backup is missing 'prospects' array");
  }

  const settings = sanitizeSettings(payload.settings);
  const accountRows = asRecordArray(payload.accounts as unknown[], "Account");
  const interactionRows = asRecordArray(payload.interactions as unknown[], "Interaction");
  const prospectRows = asRecordArray(payload.prospects as unknown[], "Prospect");

  const accountIds = validateUniqueIds(accountRows, "account");
  validateUniqueIds(interactionRows, "interaction");
  validateUniqueIds(prospectRows, "prospect");

  const accounts = accountRows.map((row, index) => sanitizeAccount(row, index));
  const interactions = interactionRows.map((row, index) =>
    sanitizeInteraction(row, index, accountIds)
  );
  const prospects = prospectRows.map((row, index) =>
    sanitizeProspect(row, index, accountIds)
  );

  const accountInsert = db.prepare(
    `INSERT INTO accounts (${ACCOUNT_COLUMNS.join(", ")})
     VALUES (${ACCOUNT_COLUMNS.map((c) => `@${c}`).join(", ")})`
  );
  const interactionInsert = db.prepare(
    `INSERT INTO interactions (${INTERACTION_COLUMNS.join(", ")})
     VALUES (${INTERACTION_COLUMNS.map((c) => `@${c}`).join(", ")})`
  );
  const prospectInsert = db.prepare(
    `INSERT INTO prospects (${PROSPECT_COLUMNS.join(", ")})
     VALUES (${PROSPECT_COLUMNS.map((c) => `@${c}`).join(", ")})`
  );
  const updateSettings = db.prepare(
    `UPDATE settings
       SET workspace = @workspace,
           company   = @company,
           tier1_def = @tier1_def,
           tiers_def = @tiers_def,
           ai_provider = @ai_provider,
           model     = @model
     WHERE id = 1`
  );

  const run = db.transaction(() => {
    db.prepare("DELETE FROM prospects").run();
    db.prepare("DELETE FROM interactions").run();
    db.prepare("DELETE FROM accounts").run();

    updateSettings.run(settings);

    for (const a of accounts) {
      accountInsert.run(pick(a, ACCOUNT_COLUMNS));
    }
    for (const i of interactions) {
      interactionInsert.run(pick(i, INTERACTION_COLUMNS));
    }
    for (const p of prospects) {
      prospectInsert.run(pick(p, PROSPECT_COLUMNS));
    }

    const fkErrors = db.prepare("PRAGMA foreign_key_check").all() as unknown[];
    if (fkErrors.length > 0) {
      throw new Error("Restore failed foreign-key validation");
    }
  });

  run();

  return {
    accounts: accounts.length,
    interactions: interactions.length,
    prospects: prospects.length,
  };
}
