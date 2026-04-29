import { db } from "./db";
import { addDaysIso, assertDateOnly, todayIso } from "./dates";
import type { Tier } from "./config";
import {
  type AccountRow,
  type MorningQueueBucketId,
  type MorningQueueGroup,
  type MorningQueueItem,
  rowToAccount,
} from "./types";

const ACCOUNT_SELECT_COLS = `
  a.id, a.name, a.website, a.industry, a.location, a.headcount,
  a.custom_fields,
  a.stage, a.notes,
  a.ai_tier, a.ai_confidence, a.ai_evidence, a.ai_reasoning, a.ai_gaps,
  a.ai_proposed_at, a.scoring_error,
  a.human_tier, a.human_verified_at,
  a.followup_date, a.followup_reason,
  a.call_prep, a.call_prep_date, a.last_activity_at,
  a.created_at, a.updated_at
`;

const BUCKETS: Array<{
  id: MorningQueueBucketId;
  label: string;
  description: string;
}> = [
  {
    id: "overdue-tier12-followups",
    label: "Overdue Tier 1/2 follow-ups",
    description: "Highest-value accounts with reminders already past due.",
  },
  {
    id: "today-tier12-followups",
    label: "Today's Tier 1/2 follow-ups",
    description: "Highest-value reminders due today.",
  },
  {
    id: "low-confidence-unverified",
    label: "Low-confidence AI scores",
    description: "AI-scored accounts that still need a human tier check.",
  },
  {
    id: "untouched-tier12",
    label: "Untouched Tier 1/2 accounts",
    description: "High-priority accounts with no logged interactions yet.",
  },
  {
    id: "stale-active",
    label: "Stale active accounts",
    description: "Working or follow-up accounts past the tier-specific touch window.",
  },
  {
    id: "upcoming-followups",
    label: "Upcoming follow-ups",
    description: "Scheduled reminders after today.",
  },
  {
    id: "everything-else",
    label: "Everything else",
    description: "Lower-priority accounts sorted by recent activity.",
  },
];

const BUCKET_RANK = new Map(
  BUCKETS.map((bucket, index) => [bucket.id, index] as const)
);

type QueueRow = AccountRow & {
  interaction_count: number;
  last_interaction_date: string | null;
};

const LIST_SQL = `
  SELECT ${ACCOUNT_SELECT_COLS},
         (SELECT COUNT(*) FROM interactions i WHERE i.account_id = a.id) AS interaction_count,
         (SELECT MAX(i.date) FROM interactions i WHERE i.account_id = a.id) AS last_interaction_date
    FROM accounts a
   ORDER BY a.name ASC
`;

function tierRank(tier: Tier | null): number {
  if (tier === "1") return 1;
  if (tier === "2") return 2;
  if (tier === "3") return 3;
  if (tier === "4") return 4;
  return 9;
}

function activeStaleDays(tier: Tier | null): number | null {
  if (tier === "1" || tier === "2") return 7;
  if (tier === "3") return 14;
  return null;
}

function accountAgeReferenceDate(row: QueueRow): string {
  return row.last_interaction_date ?? row.created_at.slice(0, 10);
}

export function isAccountStaleForMorningQueue(
  tier: Tier | null,
  referenceDate: string,
  today: string = todayIso()
): boolean {
  assertDateOnly(today, "Today");
  assertDateOnly(referenceDate, "Reference date");
  const days = activeStaleDays(tier);
  if (days === null) return false;
  return referenceDate <= addDaysIso(today, -days);
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const at = Date.UTC(ay, am - 1, ad);
  const bt = Date.UTC(by, bm - 1, bd);
  return Math.round((bt - at) / 86400000);
}

function followupReason(prefix: string, row: QueueRow, today: string): string {
  const accountReason = row.followup_reason ? `: ${row.followup_reason}` : "";
  if (!row.followup_date) return prefix;
  const diff = daysBetween(today, row.followup_date);
  if (diff < 0) return `${-diff}d overdue${accountReason}`;
  if (diff === 0) return `Due today${accountReason}`;
  if (diff === 1) return `Due tomorrow${accountReason}`;
  return `Due in ${diff}d${accountReason}`;
}

function classify(row: QueueRow, today: string): MorningQueueItem {
  const account = rowToAccount(row);
  const effectiveTier = account.humanTier ?? account.aiTier;
  const tier12 = effectiveTier === "1" || effectiveTier === "2";
  const isTerminal = account.stage === "meeting" || account.stage === "dead";
  const isActive = account.stage === "working" || account.stage === "followup";
  const referenceDate = accountAgeReferenceDate(row);

  let bucket: MorningQueueBucketId = "everything-else";
  let reason = "Sorted behind higher-priority queue items.";

  if (tier12 && account.followupDate && account.followupDate < today) {
    bucket = "overdue-tier12-followups";
    reason = followupReason("Overdue follow-up", row, today);
  } else if (tier12 && account.followupDate === today) {
    bucket = "today-tier12-followups";
    reason = followupReason("Follow-up due today", row, today);
  } else if (
    account.aiTier &&
    account.aiConfidence === "low" &&
    !account.humanVerifiedAt
  ) {
    bucket = "low-confidence-unverified";
    reason = `Low-confidence AI Tier ${account.aiTier} proposal needs review.`;
  } else if (tier12 && account.interactionCount === 0 && !isTerminal) {
    bucket = "untouched-tier12";
    reason = `Tier ${effectiveTier} account has no logged interactions.`;
  } else if (
    isActive &&
    isAccountStaleForMorningQueue(effectiveTier, referenceDate, today)
  ) {
    bucket = "stale-active";
    reason = row.last_interaction_date
      ? `No interaction since ${row.last_interaction_date}.`
      : "No interaction logged since this account was added.";
  } else if (account.followupDate && account.followupDate > today) {
    bucket = "upcoming-followups";
    reason = followupReason("Upcoming follow-up", row, today);
  }

  return {
    account,
    bucket,
    bucketRank: BUCKET_RANK.get(bucket) ?? 99,
    effectiveTier,
    lastInteractionDate: row.last_interaction_date,
    reason,
  };
}

function itemSort(a: MorningQueueItem, b: MorningQueueItem): number {
  if (a.bucketRank !== b.bucketRank) return a.bucketRank - b.bucketRank;
  const tierDiff = tierRank(a.effectiveTier) - tierRank(b.effectiveTier);

  if (
    a.bucket === "overdue-tier12-followups" ||
    a.bucket === "today-tier12-followups" ||
    a.bucket === "upcoming-followups"
  ) {
    const followupA = a.account.followupDate ?? "9999-12-31";
    const followupB = b.account.followupDate ?? "9999-12-31";
    if (followupA !== followupB) return followupA.localeCompare(followupB);
    if (tierDiff !== 0) return tierDiff;
  } else if (tierDiff !== 0) {
    return tierDiff;
  }

  if (a.bucket === "stale-active") {
    const lastA = a.lastInteractionDate ?? "0000-00-00";
    const lastB = b.lastInteractionDate ?? "0000-00-00";
    if (lastA !== lastB) return lastA.localeCompare(lastB);
  }

  if (a.bucket === "everything-else") {
    const activityA = a.account.lastActivityAt ?? a.account.updatedAt;
    const activityB = b.account.lastActivityAt ?? b.account.updatedAt;
    if (activityA !== activityB) return activityB.localeCompare(activityA);
  }

  return a.account.name.localeCompare(b.account.name);
}

export function listMorningQueue(
  today: string = todayIso(),
  perBucketLimit = 5
): MorningQueueGroup[] {
  assertDateOnly(today, "Today");
  const rows = db.prepare(LIST_SQL).all() as QueueRow[];
  const items = rows.map((row) => classify(row, today)).sort(itemSort);

  return BUCKETS.map((bucket) => {
    const bucketItems = items.filter((item) => item.bucket === bucket.id);
    return {
      ...bucket,
      total: bucketItems.length,
      items: bucketItems.slice(0, perBucketLimit),
    };
  });
}
