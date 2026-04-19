import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { ParsedRow } from "./import";
import {
  type Account,
  type AccountPatch,
  type AccountRow,
  type ListFilters,
  type NewAccountInput,
  rowToAccount,
} from "./types";

const LIST_SQL = `
  SELECT a.id, a.name, a.website, a.industry, a.location, a.headcount,
         a.stage, a.notes,
         a.ai_tier, a.human_tier, a.human_verified_at,
         a.followup_date, a.followup_reason,
         a.created_at, a.updated_at,
         (SELECT COUNT(*) FROM interactions i WHERE i.account_id = a.id) AS interaction_count
  FROM accounts a
  WHERE (@q IS NULL
         OR a.name     LIKE @q
         OR a.industry LIKE @q
         OR a.location LIKE @q
         OR a.website  LIKE @q)
    AND (@stage IS NULL OR a.stage = @stage)
    AND (@tier IS NULL
         OR (@tier = 'unscored' AND a.human_tier IS NULL AND a.ai_tier IS NULL)
         OR COALESCE(a.human_tier, a.ai_tier) = @tier)
    AND (@needs_review = 0 OR (a.ai_tier IS NOT NULL AND a.human_verified_at IS NULL))
    AND (@has_followup = 0 OR a.followup_date IS NOT NULL)
  ORDER BY a.updated_at DESC
  LIMIT 500
`;

export function listAccounts(filters: ListFilters = {}): Account[] {
  const qRaw = filters.q?.trim();
  const params = {
    q: qRaw ? `%${qRaw}%` : null,
    stage: filters.stage ?? null,
    tier: filters.tier ?? null,
    needs_review: filters.needsReview ? 1 : 0,
    has_followup: filters.hasFollowup ? 1 : 0,
  };
  const rows = db.prepare(LIST_SQL).all(params) as AccountRow[];
  return rows.map(rowToAccount);
}

const GET_SQL = `
  SELECT a.id, a.name, a.website, a.industry, a.location, a.headcount,
         a.stage, a.notes,
         a.ai_tier, a.human_tier, a.human_verified_at,
         a.followup_date, a.followup_reason,
         a.created_at, a.updated_at
  FROM accounts a
  WHERE a.id = ?
`;

export function getAccount(id: string): Account | null {
  const row = db.prepare(GET_SQL).get(id) as AccountRow | undefined;
  return row ? rowToAccount(row) : null;
}

export function createAccount(input: NewAccountInput): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO accounts (id, name, website, industry, location, headcount, created_at, updated_at)
     VALUES (@id, @name, @website, @industry, @location, @headcount, @now, @now)`
  ).run({
    id,
    name: input.name.trim(),
    website: input.website?.trim() || null,
    industry: input.industry?.trim() || null,
    location: input.location?.trim() || null,
    headcount: input.headcount?.trim() || null,
    now,
  });
  return id;
}

export function updateAccount(id: string, patch: AccountPatch): void {
  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = @updated_at"];
  const params: Record<string, unknown> = { id, updated_at: now };

  if (patch.stage !== undefined) {
    sets.push("stage = @stage");
    params.stage = patch.stage;
  }
  if (patch.notes !== undefined) {
    sets.push("notes = @notes");
    params.notes = patch.notes;
  }
  if (patch.humanTier !== undefined) {
    sets.push("human_tier = @human_tier");
    sets.push("human_verified_at = @human_verified_at");
    params.human_tier = patch.humanTier;
    params.human_verified_at = patch.humanTier === null ? null : now;
  }

  if (sets.length === 1) return; // only updated_at — nothing to do

  db.prepare(`UPDATE accounts SET ${sets.join(", ")} WHERE id = @id`).run(params);
}

export function deleteAccount(id: string): void {
  db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
}

const FIND_BY_NAME_SQL = `
  SELECT id FROM accounts WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1
`;

const INSERT_SQL = `
  INSERT INTO accounts (id, name, website, industry, location, headcount, created_at, updated_at)
  VALUES (@id, @name, @website, @industry, @location, @headcount, @now, @now)
`;

const UPDATABLE_FIELDS = ["website", "industry", "location", "headcount"] as const;

export function importAccounts(rows: ParsedRow[]): { added: number; updated: number } {
  const findByName = db.prepare(FIND_BY_NAME_SQL);
  const insert = db.prepare(INSERT_SQL);

  const run = db.transaction((rows: ParsedRow[]) => {
    let added = 0;
    let updated = 0;

    for (const row of rows) {
      const name = row.name.trim();
      if (!name) continue;

      const hit = findByName.get(name) as { id: string } | undefined;

      if (hit) {
        const now = new Date().toISOString();
        const sets: string[] = ["updated_at = @updated_at"];
        const params: Record<string, unknown> = { id: hit.id, updated_at: now };
        let touched = false;
        for (const field of UPDATABLE_FIELDS) {
          const v = row[field]?.trim();
          if (v) {
            sets.push(`${field} = @${field}`);
            params[field] = v;
            touched = true;
          }
        }
        if (touched) {
          db.prepare(`UPDATE accounts SET ${sets.join(", ")} WHERE id = @id`).run(params);
          updated++;
        }
      } else {
        const now = new Date().toISOString();
        insert.run({
          id: randomUUID(),
          name,
          website: row.website?.trim() || null,
          industry: row.industry?.trim() || null,
          location: row.location?.trim() || null,
          headcount: row.headcount?.trim() || null,
          now,
        });
        added++;
      }
    }

    return { added, updated };
  });

  return run(rows);
}
