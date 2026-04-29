import { randomUUID } from "node:crypto";
import { db } from "./db";
import { addDaysIso, dateOnlyToUtcIso, todayIso } from "./dates";
import { last7DaysStartIso } from "./stats";
import type { ParsedRow } from "./import";
import {
  normalizeAccountName,
  normalizeWebsiteDomain,
  parseCustomFields,
  serializeCustomFields,
} from "./normalization";
import {
  type Account,
  type AccountListPage,
  type AccountPatch,
  type AccountRow,
  type ListFilters,
  type NewAccountInput,
  rowToAccount,
} from "./types";

const ACCOUNT_SELECT_COLS = `
  a.id, a.name, a.website, a.industry, a.location, a.headcount,
  a.custom_fields,
  a.stage, a.notes,
  a.ai_tier, a.ai_confidence, a.ai_evidence, a.ai_reasoning, a.ai_gaps,
  a.ai_proposed_at, a.scoring_error, a.scoring_error_type, a.ai_metadata,
  a.human_tier, a.human_verified_at,
  a.followup_date, a.followup_reason,
  a.call_prep, a.call_prep_date, a.call_prep_metadata, a.last_activity_at,
  a.created_at, a.updated_at
`;

const LIST_FILTER_SQL = `
  WHERE (@q IS NULL
         OR a.name     LIKE @q
         OR a.industry LIKE @q
         OR a.location LIKE @q
         OR a.website  LIKE @q)
    AND (@stage IS NULL OR a.stage = @stage)
    AND (@tier IS NULL
         OR (@tier = 'unscored' AND a.human_tier IS NULL AND a.ai_tier IS NULL)
         OR COALESCE(a.human_tier, a.ai_tier) = @tier)
    AND (@needs_review = 0 OR (
      a.ai_tier IS NOT NULL
      AND a.ai_confidence = 'low'
      AND a.human_verified_at IS NULL
    ))
    AND (@has_followup = 0 OR a.followup_date IS NOT NULL)
    AND (@followup_bucket IS NULL
         OR (@followup_bucket = 'due' AND a.followup_date IS NOT NULL AND a.followup_date <= @today)
         OR (@followup_bucket = 'scheduled' AND a.followup_date IS NOT NULL AND a.followup_date > @today))
    AND (@touched = 0 OR EXISTS (
      SELECT 1 FROM interactions i
      WHERE i.account_id = a.id AND i.date >= @last_7_days_start
    ))
    AND (@stale_tier12 = 0 OR (
      COALESCE(a.human_tier, a.ai_tier) IN ('1', '2')
      AND a.stage IN ('working', 'followup')
      AND (
        (
          NOT EXISTS (SELECT 1 FROM interactions si WHERE si.account_id = a.id)
          AND substr(a.created_at, 1, 10) <= @stale_tier12_cutoff
        )
        OR (
          SELECT MAX(si.date)
            FROM interactions si
           WHERE si.account_id = a.id
        ) <= @stale_tier12_cutoff
      )
    ))
`;

const LIST_ORDER_SQL = `
  ORDER BY COALESCE(a.last_activity_at, a.updated_at) DESC, a.name ASC
`;

function listParams(filters: ListFilters): Record<string, unknown> {
  const qRaw = filters.q?.trim();
  const today = todayIso();
  return {
    q: qRaw ? `%${qRaw}%` : null,
    stage: filters.stage ?? null,
    tier: filters.tier ?? null,
    needs_review: filters.needsReview ? 1 : 0,
    has_followup: filters.hasFollowup ? 1 : 0,
    followup_bucket: filters.followupBucket ?? null,
    touched: filters.touched ? 1 : 0,
    stale_tier12: filters.staleTier12 ? 1 : 0,
    today,
    last_7_days_start: last7DaysStartIso(today),
    stale_tier12_cutoff: addDaysIso(today, -7),
  };
}

export function listAccounts(filters: ListFilters = {}): Account[] {
  const rows = db
    .prepare(
      `SELECT ${ACCOUNT_SELECT_COLS},
              (SELECT COUNT(*) FROM interactions i WHERE i.account_id = a.id) AS interaction_count
         FROM accounts a
         ${LIST_FILTER_SQL}
         ${LIST_ORDER_SQL}`
    )
    .all(listParams(filters)) as AccountRow[];
  return rows.map(rowToAccount);
}

export function listAccountsPage(
  filters: ListFilters = {},
  options: { page?: number; pageSize?: number } = {}
): AccountListPage {
  const params = listParams(filters);
  const requestedPage =
    Number.isInteger(options.page) && options.page ? options.page : 1;
  const pageSize =
    Number.isInteger(options.pageSize) && options.pageSize && options.pageSize > 0
      ? Math.min(options.pageSize, 500)
      : 100;

  const totalRow = db.prepare("SELECT COUNT(*) AS n FROM accounts").get() as { n: number };
  const filteredRow = db
    .prepare(`SELECT COUNT(*) AS n FROM accounts a ${LIST_FILTER_SQL}`)
    .get(params) as { n: number };

  const totalCount = totalRow.n ?? 0;
  const filteredCount = filteredRow.n ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const offset = (page - 1) * pageSize;

  const rows = db
    .prepare(
      `SELECT ${ACCOUNT_SELECT_COLS},
              (SELECT COUNT(*) FROM interactions i WHERE i.account_id = a.id) AS interaction_count
         FROM accounts a
         ${LIST_FILTER_SQL}
         ${LIST_ORDER_SQL}
        LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset }) as AccountRow[];

  return {
    accounts: rows.map(rowToAccount),
    totalCount,
    filteredCount,
    page,
    pageSize,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

const GET_SQL = `
  SELECT ${ACCOUNT_SELECT_COLS}
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
  const name = input.name.trim();
  const website = input.website?.trim() || null;
  db.prepare(
    `INSERT INTO accounts (
       id, name, website, industry, location, headcount, custom_fields,
       normalized_name, website_domain, created_at, updated_at
     )
     VALUES (
       @id, @name, @website, @industry, @location, @headcount, @custom_fields,
       @normalized_name, @website_domain, @now, @now
     )`
  ).run({
    id,
    name,
    website,
    industry: input.industry?.trim() || null,
    location: input.location?.trim() || null,
    headcount: input.headcount?.trim() || null,
    custom_fields: serializeCustomFields(input.customFields),
    normalized_name: normalizeAccountName(name),
    website_domain: normalizeWebsiteDomain(website),
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

export function touchAccountActivity(
  accountId: string,
  at: string = new Date().toISOString()
): void {
  db.prepare(
    `UPDATE accounts
        SET last_activity_at = CASE
              WHEN last_activity_at IS NULL OR @at > last_activity_at THEN @at
              ELSE last_activity_at
            END
      WHERE id = @id`
  ).run({
    id: accountId,
    at,
  });
}

export function touchAccountInteractionActivity(
  accountId: string,
  interactionDate: string
): void {
  touchAccountActivity(accountId, dateOnlyToUtcIso(interactionDate));
}

export function recomputeAccountActivity(accountId: string): void {
  const row = db
    .prepare(
      `SELECT MAX(activity_at) AS last_activity_at
         FROM (
           SELECT date || 'T00:00:00.000Z' AS activity_at
             FROM interactions
            WHERE account_id = @id
           UNION ALL
           SELECT created_at AS activity_at
             FROM prospects
            WHERE account_id = @id
         )`
    )
    .get({ id: accountId }) as { last_activity_at: string | null };

  db.prepare("UPDATE accounts SET last_activity_at = @last_activity_at WHERE id = @id").run({
    id: accountId,
    last_activity_at: row.last_activity_at ?? null,
  });
}

const INSERT_SQL = `
  INSERT INTO accounts (
    id, name, website, industry, location, headcount, custom_fields,
    normalized_name, website_domain, created_at, updated_at
  )
  VALUES (
    @id, @name, @website, @industry, @location, @headcount, @custom_fields,
    @normalized_name, @website_domain, @now, @now
  )
`;

const UPDATABLE_FIELDS = ["website", "industry", "location", "headcount"] as const;

export interface ImportMatch {
  id: string;
  name: string;
  website: string | null;
}

export interface ImportWarning {
  rowNumber: number;
  name: string;
  reason: string;
  matches: ImportMatch[];
}

export interface ImportPreviewResult {
  potentialUpdates: number;
  potentialAdds: number;
  ambiguous: ImportWarning[];
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  warnings: ImportWarning[];
}

const FIND_DEDUPE_SQL = `
  SELECT id, name, website
    FROM accounts
   WHERE normalized_name = @normalized_name
      OR (@website_domain IS NOT NULL AND website_domain = @website_domain)
   ORDER BY name ASC, created_at ASC
`;

function uniqueMatches(rows: ImportMatch[]): ImportMatch[] {
  const byId = new Map<string, ImportMatch>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
}

function findImportMatches(row: ParsedRow): ImportMatch[] {
  const normalizedName = normalizeAccountName(row.name);
  const websiteDomain = normalizeWebsiteDomain(row.website);
  if (!normalizedName && !websiteDomain) return [];
  return uniqueMatches(
    db.prepare(FIND_DEDUPE_SQL).all({
      normalized_name: normalizedName,
      website_domain: websiteDomain,
    }) as ImportMatch[]
  );
}

function mergeCustomFields(
  existingRaw: string | null,
  incoming: ParsedRow["customFields"]
): string | null {
  return serializeCustomFields({
    ...(parseCustomFields(existingRaw) ?? {}),
    ...(incoming ?? {}),
  });
}

export type ScoringWrite =
  | {
      ok: true;
      tier: "1" | "2" | "3" | "4";
      confidence: "high" | "medium" | "low";
      evidence: unknown;
      reasoning: string;
      gaps: string[];
      proposedAt: string;
      metadata: unknown;
    }
  | {
      ok: false;
      error: string;
      errorType?: "provider" | "schema";
      rawResponse: string | null;
    };

// Writes ONLY ai_* + scoring_error + updated_at columns.
// human_tier and human_verified_at are never touched here — override stickiness
// is guaranteed by SQL construction.
const WRITE_SUCCESS_SQL = `
  UPDATE accounts SET
    ai_tier        = @ai_tier,
    ai_confidence  = @ai_confidence,
    ai_evidence    = @ai_evidence,
    ai_reasoning   = @ai_reasoning,
    ai_gaps        = @ai_gaps,
    ai_proposed_at = @ai_proposed_at,
    ai_metadata    = @ai_metadata,
    scoring_error  = NULL,
    scoring_error_type = NULL,
    updated_at     = @updated_at
  WHERE id = @id
`;

const WRITE_FAILURE_SQL = `
  UPDATE accounts SET
    scoring_error = @scoring_error,
    scoring_error_type = @scoring_error_type,
    updated_at    = @updated_at
  WHERE id = @id
`;

export function writeAiScore(id: string, result: ScoringWrite): void {
  const now = new Date().toISOString();
  if (result.ok) {
    db.prepare(WRITE_SUCCESS_SQL).run({
      id,
      ai_tier: result.tier,
      ai_confidence: result.confidence,
      ai_evidence: JSON.stringify(result.evidence),
      ai_reasoning: result.reasoning,
      ai_gaps: JSON.stringify(result.gaps),
      ai_proposed_at: result.proposedAt,
      ai_metadata: JSON.stringify(result.metadata),
      updated_at: now,
    });
  } else {
    const raw = result.rawResponse ?? "";
    const payload = raw ? `${result.error}\n---\n${raw}` : result.error;
    db.prepare(WRITE_FAILURE_SQL).run({
      id,
      scoring_error: payload,
      scoring_error_type: result.errorType ?? "provider",
      updated_at: now,
    });
  }
}

export function writeCallPrep(id: string, text: string, metadata?: unknown): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE accounts
        SET call_prep      = @call_prep,
            call_prep_date = @now,
            call_prep_metadata = @call_prep_metadata,
            updated_at     = @now
      WHERE id = @id`
  ).run({
    id,
    call_prep: text,
    call_prep_metadata: metadata ? JSON.stringify(metadata) : null,
    now,
  });
}

export function clearCallPrep(id: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE accounts
        SET call_prep      = NULL,
            call_prep_date = NULL,
            call_prep_metadata = NULL,
            updated_at     = @now
      WHERE id = @id`
  ).run({ id, now });
}

export function writeAiScoresBatch(
  entries: Array<{ id: string; result: ScoringWrite }>
): void {
  if (entries.length === 0) return;
  const run = db.transaction((batch: Array<{ id: string; result: ScoringWrite }>) => {
    for (const { id, result } of batch) writeAiScore(id, result);
  });
  run(entries);
}

export function listAccountIdsForScoring(
  filter: "unscored" | "all" | "low-confidence",
  limit: number,
  opts: { includeHumanVerified?: boolean } = {}
): Array<{ id: string; name: string }> {
  let where = "1=1";
  if (filter === "unscored") where = "ai_tier IS NULL";
  else if (filter === "low-confidence")
    where = "ai_confidence = 'low' AND human_verified_at IS NULL";
  const verifiedWhere = opts.includeHumanVerified ? "" : " AND human_verified_at IS NULL";
  const sql = `SELECT id, name FROM accounts WHERE ${where}${verifiedWhere} ORDER BY updated_at ASC LIMIT @limit`;
  return db.prepare(sql).all({ limit }) as Array<{ id: string; name: string }>;
}

export function previewImportAccounts(rows: ParsedRow[]): ImportPreviewResult {
  let potentialUpdates = 0;
  let potentialAdds = 0;
  const ambiguous: ImportWarning[] = [];

  for (const [index, row] of rows.entries()) {
    const name = row.name.trim();
    if (!name) continue;
    const matches = findImportMatches(row);
    if (matches.length === 0) {
      potentialAdds++;
    } else if (matches.length === 1) {
      potentialUpdates++;
    } else {
      ambiguous.push({
        rowNumber: index + 1,
        name,
        reason: "Multiple existing accounts match the normalized name or website domain.",
        matches,
      });
    }
  }

  return { potentialUpdates, potentialAdds, ambiguous };
}

export function importAccounts(rows: ParsedRow[]): ImportResult {
  const insert = db.prepare(INSERT_SQL);
  const getExistingCustomFields = db.prepare(
    "SELECT custom_fields FROM accounts WHERE id = ?"
  );

  const run = db.transaction((rows: ParsedRow[]) => {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const warnings: ImportWarning[] = [];

    for (const [index, row] of rows.entries()) {
      const name = row.name.trim();
      if (!name) continue;
      const website = row.website?.trim() || null;
      const matches = findImportMatches(row);

      if (matches.length === 1) {
        const now = new Date().toISOString();
        const existing = getExistingCustomFields.get(matches[0].id) as
          | { custom_fields: string | null }
          | undefined;
        const sets: string[] = [
          "updated_at = @updated_at",
          "normalized_name = @normalized_name",
        ];
        const params: Record<string, unknown> = {
          id: matches[0].id,
          updated_at: now,
          normalized_name: normalizeAccountName(name),
        };
        if (website) {
          sets.push("website_domain = @website_domain");
          params.website_domain = normalizeWebsiteDomain(website);
        }
        let touched = false;
        for (const field of UPDATABLE_FIELDS) {
          const v = row[field]?.trim();
          if (v) {
            sets.push(`${field} = @${field}`);
            params[field] = v;
            touched = true;
          }
        }
        const customFields = row.customFields
          ? mergeCustomFields(existing?.custom_fields ?? null, row.customFields)
          : null;
        if (customFields) {
          sets.push("custom_fields = @custom_fields");
          params.custom_fields = customFields;
          touched = true;
        }
        if (touched || row.website) {
          db.prepare(`UPDATE accounts SET ${sets.join(", ")} WHERE id = @id`).run(params);
          updated++;
        }
      } else if (matches.length > 1) {
        skipped++;
        warnings.push({
          rowNumber: index + 1,
          name,
          reason: "Multiple existing accounts match the normalized name or website domain.",
          matches,
        });
      } else {
        const now = new Date().toISOString();
        insert.run({
          id: randomUUID(),
          name,
          website,
          industry: row.industry?.trim() || null,
          location: row.location?.trim() || null,
          headcount: row.headcount?.trim() || null,
          custom_fields: serializeCustomFields(row.customFields),
          normalized_name: normalizeAccountName(name),
          website_domain: normalizeWebsiteDomain(website),
          now,
        });
        added++;
      }
    }

    return { added, updated, skipped, warnings };
  });

  return run(rows);
}
