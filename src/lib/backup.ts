import { db } from "./db";

const ACCOUNT_COLUMNS = [
  "id",
  "name",
  "website",
  "industry",
  "location",
  "headcount",
  "stage",
  "notes",
  "ai_tier",
  "ai_confidence",
  "ai_evidence",
  "ai_reasoning",
  "ai_gaps",
  "ai_proposed_at",
  "human_tier",
  "human_verified_at",
  "followup_date",
  "followup_reason",
  "followup_set_at",
  "call_prep",
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

const SETTINGS_COLUMNS = ["workspace", "company", "tier1_def", "tiers_def", "model"] as const;

export interface BackupSettings {
  workspace: string;
  company: string;
  tier1_def: string;
  tiers_def: string;
  model: string;
}

export interface BackupV1 {
  version: 1;
  exportedAt: string;
  settings: BackupSettings;
  accounts: Record<string, unknown>[];
  interactions: Record<string, unknown>[];
  prospects: Record<string, unknown>[];
}

export function getBackup(): BackupV1 {
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
    version: 1,
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

function pick(row: Record<string, unknown>, columns: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    out[col] = row[col] ?? null;
  }
  return out;
}

export function restoreBackup(payload: unknown): {
  accounts: number;
  interactions: number;
  prospects: number;
} {
  if (!isRecord(payload)) {
    throw new Error("Backup must be a JSON object");
  }
  if (payload.version !== 1) {
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

  const settings = payload.settings as Record<string, unknown>;
  const accounts = payload.accounts as unknown[];
  const interactions = payload.interactions as unknown[];
  const prospects = payload.prospects as unknown[];

  for (const a of accounts) {
    if (!isRecord(a) || typeof a.id !== "string" || typeof a.name !== "string") {
      throw new Error("Each account must be an object with id and name");
    }
  }
  for (const i of interactions) {
    if (!isRecord(i) || typeof i.id !== "string" || typeof i.account_id !== "string") {
      throw new Error("Each interaction must be an object with id and account_id");
    }
  }
  for (const p of prospects) {
    if (!isRecord(p) || typeof p.id !== "string" || typeof p.account_id !== "string") {
      throw new Error("Each prospect must be an object with id and account_id");
    }
  }

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
           model     = @model
     WHERE id = 1`
  );

  const run = db.transaction(() => {
    db.prepare("DELETE FROM accounts").run();

    updateSettings.run({
      workspace: typeof settings.workspace === "string" ? settings.workspace : "Account Workspace",
      company: typeof settings.company === "string" ? settings.company : "",
      tier1_def: typeof settings.tier1_def === "string" ? settings.tier1_def : "",
      tiers_def: typeof settings.tiers_def === "string" ? settings.tiers_def : "",
      model: typeof settings.model === "string" ? settings.model : "",
    });

    for (const a of accounts) {
      accountInsert.run(pick(a as Record<string, unknown>, ACCOUNT_COLUMNS));
    }
    for (const i of interactions) {
      interactionInsert.run(pick(i as Record<string, unknown>, INTERACTION_COLUMNS));
    }
    for (const p of prospects) {
      prospectInsert.run(pick(p as Record<string, unknown>, PROSPECT_COLUMNS));
    }
  });

  run();

  return {
    accounts: accounts.length,
    interactions: interactions.length,
    prospects: prospects.length,
  };
}
