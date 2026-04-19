import { db } from "./db";
import type { FollowupPatch, FollowupRow } from "./types";

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function setFollowup(accountId: string, patch: FollowupPatch): void {
  const reason = patch.reason.trim();
  if (!reason) throw new Error("Reason is required");
  if (!patch.date) throw new Error("Date is required");
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE accounts
       SET followup_date = @date,
           followup_reason = @reason,
           followup_set_at = @set_at,
           updated_at = @updated_at
     WHERE id = @id`
  ).run({
    id: accountId,
    date: patch.date,
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
           updated_at = @updated_at
     WHERE id = @id`
  ).run({ id: accountId, updated_at: now });
}

export function snoozeFollowup(accountId: string, days: number): void {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("Snooze days must be positive");
  }
  const row = db
    .prepare("SELECT followup_date FROM accounts WHERE id = ?")
    .get(accountId) as { followup_date: string | null } | undefined;
  if (!row || !row.followup_date) return;
  const today = todayIso();
  const base = row.followup_date < today ? today : row.followup_date;
  const next = addDaysIso(base, days);
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE accounts
       SET followup_date = @date,
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
  const horizon = addDaysIso(today, horizonDays);
  return db.prepare(LIST_SQL).all({ today, horizon }) as FollowupRow[];
}
