import { db } from "./db";
import {
  addDaysIso,
  assertDateOnly,
  assertDateOnlyOnOrAfter,
  todayIso,
} from "./dates";
import type { FollowupPatch, FollowupRow } from "./types";

export { addDaysIso, todayIso };

export function setFollowup(accountId: string, patch: FollowupPatch): void {
  const reason = patch.reason.trim();
  if (!reason) throw new Error("Reason is required");
  const date = assertDateOnlyOnOrAfter(
    patch.date,
    todayIso(),
    "Follow-up date"
  );
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE accounts
       SET followup_date = @date,
           followup_reason = @reason,
           followup_set_at = @set_at,
           stage = CASE
             WHEN stage IN ('meeting', 'dead') THEN stage
             ELSE 'followup'
           END,
           updated_at = @updated_at
     WHERE id = @id`
  ).run({
    id: accountId,
    date,
    reason,
    set_at: now,
    updated_at: now,
  });
}

export function clearFollowup(accountId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE accounts
       SET followup_date = NULL,
           followup_reason = NULL,
           followup_set_at = NULL,
           stage = CASE
             WHEN stage = 'followup' THEN 'working'
             ELSE stage
           END,
           updated_at = @updated_at
     WHERE id = @id`
  ).run({ id: accountId, updated_at: now });
}

export function snoozeFollowup(
  accountId: string,
  days: number,
  today: string = todayIso()
): void {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("Snooze days must be positive");
  }
  assertDateOnly(today, "Today");
  const row = db
    .prepare("SELECT followup_date FROM accounts WHERE id = ?")
    .get(accountId) as { followup_date: string | null } | undefined;
  if (!row || !row.followup_date) return;
  const base = row.followup_date < today ? today : row.followup_date;
  const next = addDaysIso(base, days);
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE accounts
       SET followup_date = @date,
           stage = CASE
             WHEN stage IN ('meeting', 'dead') THEN stage
             ELSE 'followup'
           END,
           updated_at = @updated_at
     WHERE id = @id`
  ).run({ id: accountId, date: next, updated_at: now });
}

const LIST_SQL = `
  SELECT
    id AS accountId,
    name AS accountName,
    followup_date AS followupDate,
    followup_reason AS followupReason,
    CASE
      WHEN followup_date < @today THEN 'overdue'
      WHEN followup_date = @today THEN 'today'
      ELSE 'upcoming'
    END AS bucket
  FROM accounts
  WHERE followup_date IS NOT NULL AND followup_date <= @horizon
  ORDER BY followup_date ASC, name ASC
`;

export function listFollowupsWithBuckets(
  today: string = todayIso(),
  horizonDays = 7
): FollowupRow[] {
  assertDateOnly(today, "Today");
  const horizon = addDaysIso(today, horizonDays);
  return db.prepare(LIST_SQL).all({ today, horizon }) as FollowupRow[];
}
