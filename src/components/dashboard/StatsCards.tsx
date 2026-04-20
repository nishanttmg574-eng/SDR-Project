import Link from "next/link";
import { getDashboardStats } from "@/lib/stats";

export function StatsCards() {
  const stats = getDashboardStats();
  const needsReviewAlert = stats.needsReview > 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card href="/" label="Total accounts" value={stats.total} />
      <Card
        href="/?has_followup=1"
        label="Follow-ups due"
        value={stats.followupsDue}
        sub={
          stats.followupsOverdue > 0
            ? { text: `${stats.followupsOverdue} overdue`, color: "text-red-600" }
            : null
        }
      />
      <Card
        href="/?touched=1"
        label="Touched this week"
        value={stats.touchedThisWeek}
        sub={{ text: "Last 7 days", color: "text-neutral-500" }}
      />
      <Card
        href="/?needs_review=1"
        label="Needs review"
        value={stats.needsReview}
        alert={needsReviewAlert}
        sub={
          needsReviewAlert
            ? { text: "Low confidence · no override", color: "text-amber-700" }
            : { text: "All good", color: "text-neutral-500" }
        }
      />
    </div>
  );
}

function Card({
  href,
  label,
  value,
  sub,
  alert,
}: {
  href: string;
  label: string;
  value: number;
  sub?: { text: string; color: string } | null;
  alert?: boolean;
}) {
  const base =
    "rounded-lg border px-4 py-3 hover:border-neutral-400 hover:bg-neutral-50";
  const tone = alert
    ? "border-amber-300 bg-amber-50"
    : "border-neutral-200 bg-white";
  return (
    <Link href={href} className={`${base} ${tone}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          alert ? "text-amber-800" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
      {sub ? <div className={`mt-0.5 text-xs ${sub.color}`}>{sub.text}</div> : null}
    </Link>
  );
}
