import Link from "next/link";
import { STAGE_LABELS } from "@/lib/config";
import { listFollowupsWithBuckets, todayIso } from "@/lib/followups";
import { listMorningQueue } from "@/lib/morning-queue";
import type {
  FollowupRow,
  MorningQueueBucketId,
  MorningQueueGroup,
  MorningQueueItem,
} from "@/lib/types";
import { ConfidenceDot } from "@/components/ai/ConfidenceDot";
import { FollowupRowActions } from "./FollowupRowActions";

const MAX_VISIBLE = 3;

const LOWER_QUEUE_EXCLUDED: MorningQueueBucketId[] = [
  "overdue-tier12-followups",
  "everything-else",
];

const GROUP_TONE: Record<
  MorningQueueBucketId,
  { title: string; row: string; badge: string }
> = {
  "overdue-tier12-followups": {
    title: "text-red-700",
    row: "border-red-200 bg-red-50",
    badge: "bg-red-100 text-red-700",
  },
  "today-tier12-followups": {
    title: "text-amber-700",
    row: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
  },
  "low-confidence-unverified": {
    title: "text-blue-700",
    row: "border-blue-200 bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
  },
  "untouched-tier12": {
    title: "text-violet-700",
    row: "border-violet-200 bg-violet-50",
    badge: "bg-violet-100 text-violet-700",
  },
  "stale-active": {
    title: "text-orange-700",
    row: "border-orange-200 bg-orange-50",
    badge: "bg-orange-100 text-orange-700",
  },
  "upcoming-followups": {
    title: "text-emerald-700",
    row: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700",
  },
  "everything-else": {
    title: "text-neutral-700",
    row: "border-neutral-200 bg-white",
    badge: "bg-neutral-100 text-neutral-700",
  },
};

export function OverdueFollowupsStrip() {
  const today = todayIso();
  const overdue = listFollowupsWithBuckets(today, 0).filter(
    (row) => row.bucket === "overdue"
  );

  if (overdue.length === 0) return null;

  const visible = overdue.slice(0, MAX_VISIBLE);
  const hiddenCount = overdue.length - visible.length;

  return (
    <section className="rounded-lg border border-red-200 bg-red-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-100 px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-red-800">
            Overdue follow-ups
            <span className="ml-2 font-normal text-red-600">
              ({overdue.length})
            </span>
          </h2>
        </div>
        <Link href="/?followup=due" className="text-xs font-medium text-red-700 hover:underline">
          View due
        </Link>
      </div>
      <ul className="divide-y divide-red-100">
        {visible.map((row) => (
          <OverdueRow key={row.accountId} row={row} today={today} />
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <div className="px-4 py-2 text-xs text-red-700">
          {hiddenCount} more overdue follow-ups.
        </div>
      ) : null}
    </section>
  );
}

export function PriorityQueueSection() {
  const groups = listMorningQueue()
    .filter((group) => !LOWER_QUEUE_EXCLUDED.includes(group.id))
    .filter((group) => group.total > 0);

  if (groups.length === 0) return null;

  const total = groups.reduce((sum, group) => sum + group.total, 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-950">
          Priority queue
          <span className="ml-2 text-sm font-normal text-neutral-400">
            ({total})
          </span>
        </h2>
      </div>
      <div className="space-y-3">
        {groups.map((group) => (
          <QueueGroup key={group.id} group={group} />
        ))}
      </div>
    </section>
  );
}

function QueueGroup({ group }: { group: MorningQueueGroup }) {
  const tone = GROUP_TONE[group.id];
  const hiddenCount = group.total - group.items.length;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className={`text-sm font-medium ${tone.title}`}>
          {group.label}
          <span className="ml-2 text-neutral-400">({group.total})</span>
        </h3>
        <p className="text-xs text-neutral-500">{group.description}</p>
      </div>
      <ul className="space-y-2">
        {group.items.map((item) => (
          <QueueRow key={item.account.id} item={item} tone={tone} />
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <div className="px-1 text-xs text-neutral-500">
          {hiddenCount} more in this bucket.
        </div>
      ) : null}
    </div>
  );
}

function QueueRow({
  item,
  tone,
}: {
  item: MorningQueueItem;
  tone: { row: string; badge: string };
}) {
  const { account } = item;
  const tier = item.effectiveTier ? `Tier ${item.effectiveTier}` : "Unscored";

  return (
    <li
      className={`grid gap-3 rounded-lg border px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] ${tone.row}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/accounts/${account.id}`}
            className="min-w-0 truncate font-medium text-neutral-950 hover:text-blue-700"
          >
            {account.name}
          </Link>
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone.badge}`}>
            {tier}
          </span>
          {account.aiConfidence ? (
            <ConfidenceDot confidence={account.aiConfidence} size="sm" />
          ) : null}
          <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs text-neutral-600">
            {STAGE_LABELS[account.stage]}
          </span>
        </div>
        <p className="mt-1 text-neutral-700">{item.reason}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
          {account.followupDate ? <span>Follow-up {account.followupDate}</span> : null}
          <span>
            {item.lastInteractionDate
              ? `Last interaction ${item.lastInteractionDate}`
              : "No interactions logged"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:justify-end">
        <Link
          href={`/accounts/${account.id}?tab=interactions&new=1`}
          className="text-xs font-medium text-blue-700 hover:underline"
        >
          Log interaction
        </Link>
        <Link
          href={`/accounts/${account.id}?tab=followup`}
          className="text-xs font-medium text-neutral-700 hover:underline"
        >
          Follow-up
        </Link>
      </div>
    </li>
  );
}

function OverdueRow({ row, today }: { row: FollowupRow; today: string }) {
  return (
    <li className="grid gap-2 px-4 py-2.5 text-sm sm:grid-cols-[5rem_minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-center">
      <span className="font-medium tabular-nums text-red-800">
        {formatDate(row.followupDate, today)}
      </span>
      <Link
        href={`/accounts/${row.accountId}`}
        className="min-w-0 truncate font-medium text-neutral-950 hover:text-blue-700"
      >
        {row.accountName}
      </Link>
      <span className="min-w-0 truncate text-neutral-700">
        {row.followupReason ?? "No reason saved"}
      </span>
      <FollowupRowActions accountId={row.accountId} />
    </li>
  );
}

function formatDate(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === -1) return "1d late";
  return `${-diff}d late`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const at = Date.UTC(ay, am - 1, ad);
  const bt = Date.UTC(by, bm - 1, bd);
  return Math.round((bt - at) / 86400000);
}
