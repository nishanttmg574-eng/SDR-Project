import { db } from "./db";
import { addDaysIso, todayIso } from "./followups";
import type { DashboardStats } from "./types";

export function weekStartIso(today: string = todayIso()): string {
  return addDaysIso(today, -7);
}

export function getDashboardStats(): DashboardStats {
  const today = todayIso();
  const weekStart = weekStartIso(today);

  const totalRow = db.prepare("SELECT COUNT(*) AS n FROM accounts").get() as {
    n: number;
  };

  const followupsRow = db
    .prepare(
      `SELECT
         SUM(CASE WHEN followup_date IS NOT NULL THEN 1 ELSE 0 END) AS due,
         SUM(CASE WHEN followup_date IS NOT NULL AND followup_date < @today THEN 1 ELSE 0 END) AS overdue
       FROM accounts`
    )
    .get({ today }) as { due: number | null; overdue: number | null };

  const touchedRow = db
    .prepare(
      `SELECT COUNT(DISTINCT account_id) AS n
         FROM interactions
        WHERE date >= @week_start`
    )
    .get({ week_start: weekStart }) as { n: number };

  const needsReviewRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM accounts
       WHERE ai_confidence = 'low' AND human_verified_at IS NULL`
    )
    .get() as { n: number };

  return {
    total: totalRow.n ?? 0,
    followupsDue: followupsRow.due ?? 0,
    followupsOverdue: followupsRow.overdue ?? 0,
    touchedThisWeek: touchedRow.n ?? 0,
    needsReview: needsReviewRow.n ?? 0,
  };
}
