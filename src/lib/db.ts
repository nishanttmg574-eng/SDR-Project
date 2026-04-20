import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "workspace.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  website             TEXT,
  industry            TEXT,
  location            TEXT,
  headcount           TEXT,
  stage               TEXT NOT NULL DEFAULT 'new'
                        CHECK (stage IN ('new','working','followup','meeting','dead')),
  notes               TEXT NOT NULL DEFAULT '',

  ai_tier             TEXT,
  ai_confidence       TEXT,
  ai_evidence         TEXT,  -- JSON: { funding, countries, hiring, entity_match }
  ai_reasoning        TEXT,
  ai_gaps             TEXT,  -- JSON array
  ai_proposed_at      TEXT,
  scoring_error       TEXT,

  human_tier          TEXT,
  human_verified_at   TEXT,

  followup_date       TEXT,
  followup_reason     TEXT,
  followup_set_at     TEXT,

  call_prep           TEXT,  -- JSON (generated on demand)

  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_stage         ON accounts(stage);
CREATE INDEX IF NOT EXISTS idx_accounts_followup_date ON accounts(followup_date);
CREATE INDEX IF NOT EXISTS idx_accounts_updated_at    ON accounts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_ai_confidence ON accounts(ai_confidence);

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
CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date       ON interactions(date DESC);

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
CREATE INDEX IF NOT EXISTS idx_prospects_account_id ON prospects(account_id);

CREATE TABLE IF NOT EXISTS settings (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  workspace       TEXT NOT NULL DEFAULT 'Account Workspace',
  company         TEXT NOT NULL DEFAULT '',
  tier1_def       TEXT NOT NULL DEFAULT '',
  tiers_def       TEXT NOT NULL DEFAULT '',
  model           TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO settings (id) VALUES (1);
`;

export function migrate(): void {
  db.exec(SCHEMA);

  const cols = db.prepare("PRAGMA table_info(accounts)").all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("scoring_error")) {
    db.exec("ALTER TABLE accounts ADD COLUMN scoring_error TEXT");
  }
}

migrate();
