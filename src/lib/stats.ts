import { db } from "./db";
import { addDaysIso, assertDateOnly, todayIso } from "./dates";
import type { DashboardStats } from "./types";

export function last7DaysStartIso(today: string = todayIso()): string {
  assertDateOnly(today, "Today");
  return addDaysIso(today, -6);
}

export function getDashboardStats(today: string = todayIso()): DashboardStats {
  assertDateOnly(today, "Today");
  const last7DaysStart = last7DaysStartIso(today);

  const totalRow = db.prepare("SELECT COUNT(*) AS n FROM accounts").get() as {
    n: number;
  };

  const followupsRow = db
    .prepare(
      `SELECT
         SUM(CASE WHEN followup_date IS NOT NULL AND followup_date <= @today THEN 1 ELSE 0 END) AS due,
         SUM(CASE WHEN followup_date IS NOT NULL AND followup_date < @today THEN 1 ELSE 0 END) AS overdue,
         SUM(CASE WHEN followup_date IS NOT NULL AND followup_date > @today THEN 1 ELSE 0 END) AS scheduled
       FROM accounts`
    )
    .get({ today }) as {
      due: number | null;
      overdue: number | null;
      scheduled: number | null;
    };

  const activityRow = db
    .prepare(
      `SELECT
         COUNT(*) AS touches,
         COUNT(DISTINCT account_id) AS unique_accounts,
         SUM(CASE WHEN outcome IN ('connected', 'replied') THEN 1 ELSE 0 END) AS connects_replies,
         SUM(CASE WHEN outcome = 'meeting' THEN 1 ELSE 0 END) AS meetings
         FROM interactions
        WHERE date >= @last_7_days_start`
    )
    .get({ last_7_days_start: last7DaysStart }) as {
      touches: number;
      unique_accounts: number;
      connects_replies: number | null;
      meetings: number | null;
    };

  const needsReviewRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM accounts
       WHERE ai_tier IS NOT NULL
         AND ai_confidence = 'low'
         AND human_verified_at IS NULL`
    )
    .get() as { n: number };

  const staleTier12Row = db
    .prepare(
      `WITH last_interactions AS (
         SELECT account_id, MAX(date) AS last_interaction_date
           FROM interactions
          GROUP BY account_id
       )
       SELECT COUNT(*) AS n
         FROM accounts a
         LEFT JOIN last_interactions li ON li.account_id = a.id
        WHERE COALESCE(a.human_tier, a.ai_tier) IN ('1', '2')
          AND a.stage IN ('working', 'followup')
          AND (
            (
              li.last_interaction_date IS NULL
              AND substr(a.created_at, 1, 10) <= @stale_cutoff
            )
            OR li.last_interaction_date <= @stale_cutoff
          )`
    )
    .get({ stale_cutoff: addDaysIso(today, -7) }) as { n: number };

  return {
    total: totalRow.n ?? 0,
    followupsDue: followupsRow.due ?? 0,
    followupsOverdue: followupsRow.overdue ?? 0,
    followupsScheduled: followupsRow.scheduled ?? 0,
    touchesLoggedLast7Days: activityRow.touches ?? 0,
    uniqueAccountsTouchedLast7Days: activityRow.unique_accounts ?? 0,
    connectsAndRepliesLast7Days: activityRow.connects_replies ?? 0,
    meetingsBookedLast7Days: activityRow.meetings ?? 0,
    staleTier1And2Accounts: staleTier12Row.n ?? 0,
    touchedLast7Days: activityRow.unique_accounts ?? 0,
    needsReview: needsReviewRow.n ?? 0,
  };
}
