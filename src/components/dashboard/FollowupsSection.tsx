import Link from "next/link";
import { listFollowupsWithBuckets, todayIso } from "@/lib/followups";
import type { FollowupRow } from "@/lib/types";
import { FollowupRowActions } from "./FollowupRowActions";

export function FollowupsSection() {
  const today = todayIso();
  const rows = listFollowupsWithBuckets(today, 7);
  if (rows.length === 0) return null;

  const overdue = rows.filter((r) => r.bucket === "overdue");
  const todayBucket = rows.filter((r) => r.bucket === "today");
  const upcoming = rows.filter((r) => r.bucket === "upcoming");

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-800">
          Follow-ups
          <span className="ml-2 text-neutral-400">({rows.length})</span>
        </h2>
        <Link
          href="/?has_followup=1"
          className="text-xs text-blue-600 hover:underline"
        >
          View all
        </Link>
      </div>

      {overdue.length > 0 ? (
        <Group
          title={`Overdue (${overdue.length})`}
          titleClass="text-red-700"
          rowClass="border-red-200 bg-red-50"
          rows={overdue}
          today={today}
        />
      ) : null}

      {todayBucket.length > 0 ? (
        <Group
          title={`Today (${todayBucket.length})`}
          titleClass="text-amber-700"
          rowClass="border-amber-200 bg-amber-50"
          rows={todayBucket}
          today={today}
        />
      ) : null}

      {upcoming.length > 0 ? (
        <Group
          title={`Next 7 days (${upcoming.length})`}
          titleClass="text-neutral-700"
          rowClass="border-neutral-200 bg-white"
          rows={upcoming}
          today={today}
        />
      ) : null}
    </section>
  );
}

function Group({
  title,
  titleClass,
  rowClass,
  rows,
  today,
}: {
  title: string;
  titleClass: string;
  rowClass: string;
  rows: FollowupRow[];
  today: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className={`text-xs font-medium ${titleClass}`}>{title}</div>
      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border">
        {rows.map((r) => (
          <li
            key={r.accountId}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm ${rowClass}`}
          >
            <span className="w-24 shrink-0 font-medium tabular-nums text-neutral-700">
              {formatDate(r.followupDate, today)}
            </span>
            <Link
              href={`/accounts/${r.accountId}`}
              className="w-48 shrink-0 truncate font-medium text-neutral-900 hover:text-blue-700"
            >
              {r.accountName}
            </Link>
            <span className="min-w-0 flex-1 truncate text-neutral-600">
              {r.followupReason ?? "—"}
            </span>
            <FollowupRowActions accountId={r.accountId} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string, today: string): string {
  if (iso === today) return "Today";
  const diff = daysBetween(today, iso);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0 && diff <= 7) return `In ${diff}d`;
  if (diff < 0) return `${-diff}d late`;
  return iso;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const at = Date.UTC(ay, am - 1, ad);
  const bt = Date.UTC(by, bm - 1, bd);
  return Math.round((bt - at) / 86400000);
}
