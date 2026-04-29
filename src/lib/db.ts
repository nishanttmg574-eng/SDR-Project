import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENAI_MODEL,
  modelLooksOpenAi,
} from "./config";
import {
  normalizeAccountName,
  normalizeWebsiteDomain,
} from "./normalization";

const DB_PATH =
  process.env.ACCOUNT_WORKSPACE_DB_PATH ?? path.join(process.cwd(), "data", "workspace.db");
const DATA_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("busy_timeout = 10000");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export const SCHEMA_VERSION = 4;

const TABLES_SQL = `
CREATE TABLE IF NOT EXISTS accounts (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  website             TEXT,
  industry            TEXT,
  location            TEXT,
  headcount           TEXT,
  custom_fields       TEXT,
  normalized_name     TEXT,
  website_domain      TEXT,
  stage               TEXT NOT NULL DEFAULT 'new'
                        CHECK (stage IN ('new','working','followup','meeting','dead')),
  notes               TEXT NOT NULL DEFAULT '',

  ai_tier             TEXT CHECK (ai_tier IS NULL OR ai_tier IN ('1','2','3','4')),
  ai_confidence       TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('high','medium','low')),
  ai_evidence         TEXT,  -- JSON: { funding, countries, countrySources, hiring, entity_match }
  ai_reasoning        TEXT,
  ai_gaps             TEXT,  -- JSON array
  ai_proposed_at      TEXT,
  scoring_error       TEXT,
  scoring_error_type  TEXT CHECK (scoring_error_type IS NULL OR scoring_error_type IN ('provider','schema')),
  ai_metadata         TEXT,

  human_tier          TEXT CHECK (human_tier IS NULL OR human_tier IN ('1','2','3','4')),
  human_verified_at   TEXT,

  followup_date       TEXT,
  followup_reason     TEXT,
  followup_set_at     TEXT,

  call_prep           TEXT,  -- JSON (generated on demand)
  call_prep_date      TEXT,
  call_prep_metadata  TEXT,
  last_activity_at    TEXT,

  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interactions (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  channel     TEXT,
  person      TEXT,
  outcome     TEXT
                CHECK (outcome IN ('no-answer','connected','replied','meeting','objection','dead')),
  notes       TEXT NOT NULL DEFAULT '',
  next_step   TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prospects (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  title       TEXT,
  email       TEXT,
  phone       TEXT,
  linkedin    TEXT,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  workspace       TEXT NOT NULL DEFAULT 'Account Workspace',
  company         TEXT NOT NULL DEFAULT '',
  tier1_def       TEXT NOT NULL DEFAULT '',
  tiers_def       TEXT NOT NULL DEFAULT '',
  ai_provider     TEXT NOT NULL DEFAULT 'openai'
                    CHECK (ai_provider IN ('openai','anthropic')),
  model           TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO settings (id) VALUES (1);
`;

const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_accounts_stage          ON accounts(stage);
CREATE INDEX IF NOT EXISTS idx_accounts_followup_date  ON accounts(followup_date);
CREATE INDEX IF NOT EXISTS idx_accounts_updated_at     ON accounts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_ai_confidence  ON accounts(ai_confidence);
CREATE INDEX IF NOT EXISTS idx_accounts_last_activity  ON accounts(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_normalized_name ON accounts(normalized_name);
CREATE INDEX IF NOT EXISTS idx_accounts_website_domain  ON accounts(website_domain);
CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date       ON interactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_account_id    ON prospects(account_id);
`;

const CONSTRAINT_TRIGGERS_SQL = `
CREATE TRIGGER IF NOT EXISTS validate_accounts_ai_tier_insert
BEFORE INSERT ON accounts
WHEN NEW.ai_tier IS NOT NULL AND NEW.ai_tier NOT IN ('1','2','3','4')
BEGIN
  SELECT RAISE(ABORT, 'Invalid ai_tier');
END;

CREATE TRIGGER IF NOT EXISTS validate_accounts_ai_tier_update
BEFORE UPDATE OF ai_tier ON accounts
WHEN NEW.ai_tier IS NOT NULL AND NEW.ai_tier NOT IN ('1','2','3','4')
BEGIN
  SELECT RAISE(ABORT, 'Invalid ai_tier');
END;

CREATE TRIGGER IF NOT EXISTS validate_accounts_human_tier_insert
BEFORE INSERT ON accounts
WHEN NEW.human_tier IS NOT NULL AND NEW.human_tier NOT IN ('1','2','3','4')
BEGIN
  SELECT RAISE(ABORT, 'Invalid human_tier');
END;

CREATE TRIGGER IF NOT EXISTS validate_accounts_human_tier_update
BEFORE UPDATE OF human_tier ON accounts
WHEN NEW.human_tier IS NOT NULL AND NEW.human_tier NOT IN ('1','2','3','4')
BEGIN
  SELECT RAISE(ABORT, 'Invalid human_tier');
END;

CREATE TRIGGER IF NOT EXISTS validate_accounts_ai_confidence_insert
BEFORE INSERT ON accounts
WHEN NEW.ai_confidence IS NOT NULL AND NEW.ai_confidence NOT IN ('high','medium','low')
BEGIN
  SELECT RAISE(ABORT, 'Invalid ai_confidence');
END;

CREATE TRIGGER IF NOT EXISTS validate_accounts_ai_confidence_update
BEFORE UPDATE OF ai_confidence ON accounts
WHEN NEW.ai_confidence IS NOT NULL AND NEW.ai_confidence NOT IN ('high','medium','low')
BEGIN
  SELECT RAISE(ABORT, 'Invalid ai_confidence');
END;
`;

function tableExists(database: Database.Database, table: string): boolean {
  const row = database
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { ok: number } | undefined;
  return !!row;
}

function tableColumns(database: Database.Database, table: string): Set<string> {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(cols.map((c) => c.name));
}

function addColumnIfMissing(
  database: Database.Database,
  table: string,
  column: string,
  definition: string
): void {
  if (!tableColumns(database, table).has(column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function backfillLastActivity(database: Database.Database): void {
  database.exec(`
    UPDATE accounts
       SET last_activity_at = (
         SELECT MAX(activity_at)
           FROM (
             SELECT i.date || 'T00:00:00.000Z' AS activity_at
               FROM interactions i
              WHERE i.account_id = accounts.id
             UNION ALL
             SELECT p.created_at AS activity_at
               FROM prospects p
              WHERE p.account_id = accounts.id
           )
       )
     WHERE last_activity_at IS NULL
       AND EXISTS (
         SELECT 1 FROM interactions i WHERE i.account_id = accounts.id
         UNION ALL
         SELECT 1 FROM prospects p WHERE p.account_id = accounts.id
       )
  `);
}

function backfillAccountSearchKeys(database: Database.Database): void {
  const rows = database
    .prepare("SELECT id, name, website FROM accounts")
    .all() as Array<{ id: string; name: string; website: string | null }>;
  const update = database.prepare(
    `UPDATE accounts
        SET normalized_name = @normalized_name,
            website_domain = @website_domain
      WHERE id = @id`
  );

  for (const row of rows) {
    update.run({
      id: row.id,
      normalized_name: normalizeAccountName(row.name),
      website_domain: normalizeWebsiteDomain(row.website),
    });
  }
}

export function migrateDatabase(database: Database.Database): void {
  const startingVersion = database.pragma("user_version", {
    simple: true,
  }) as number;
  const hadSettingsTable = tableExists(database, "settings");
  const hadAccountsTable = tableExists(database, "accounts");

  const run = database.transaction(() => {
    database.exec(TABLES_SQL);

    const currentVersion = startingVersion;

    if (currentVersion < 1) {
      addColumnIfMissing(database, "accounts", "scoring_error", "TEXT");
      addColumnIfMissing(database, "accounts", "call_prep_date", "TEXT");
      addColumnIfMissing(database, "accounts", "last_activity_at", "TEXT");
      backfillLastActivity(database);
      database.pragma("user_version = 1");
    }

    if (currentVersion < 2) {
      addColumnIfMissing(database, "accounts", "custom_fields", "TEXT");
      addColumnIfMissing(database, "accounts", "normalized_name", "TEXT");
      addColumnIfMissing(database, "accounts", "website_domain", "TEXT");
      database.pragma("user_version = 2");
    }

    if (currentVersion < 3) {
      backfillAccountSearchKeys(database);
      database.pragma("user_version = 3");
    }

    if (currentVersion < 4) {
      addColumnIfMissing(database, "settings", "ai_provider", "TEXT NOT NULL DEFAULT 'openai'");
      addColumnIfMissing(database, "accounts", "scoring_error_type", "TEXT");
      addColumnIfMissing(database, "accounts", "ai_metadata", "TEXT");
      addColumnIfMissing(database, "accounts", "call_prep_metadata", "TEXT");

      const isFreshDatabase = !hadSettingsTable && !hadAccountsTable && startingVersion === 0;
      const settings = database
        .prepare("SELECT model FROM settings WHERE id = 1")
        .get() as { model: string } | undefined;
      const currentModel = settings?.model?.trim() ?? "";
      const provider = isFreshDatabase
        ? "openai"
        : modelLooksOpenAi(currentModel)
          ? "openai"
          : "anthropic";
      const model =
        currentModel ||
        (provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL);

      database
        .prepare(
          `UPDATE settings
              SET ai_provider = @provider,
                  model = @model
            WHERE id = 1`
        )
        .run({ provider, model });

      database.pragma("user_version = 4");
    }

    database.exec(INDEXES_SQL);
    database.exec(CONSTRAINT_TRIGGERS_SQL);

    const finalVersion = database.pragma("user_version", {
      simple: true,
    }) as number;
    if (finalVersion < SCHEMA_VERSION) {
      database.pragma(`user_version = ${SCHEMA_VERSION}`);
    }
  });

  run();
}

export function migrate(): void {
  migrateDatabase(db);
}

migrate();
