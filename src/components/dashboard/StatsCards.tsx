import Link from "next/link";
import { getDashboardStats } from "@/lib/stats";

export function StatsCards() {
  const stats = getDashboardStats();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
    </div>
  );
}

function Card({
  href,
  label,
  value,
  sub,
}: {
  href: string;
  label: string;
  value: number;
  sub?: { text: string; color: string } | null;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-400 hover:bg-neutral-50"
    >
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
        {value}
      </div>
      {sub ? <div className={`mt-0.5 text-xs ${sub.color}`}>{sub.text}</div> : null}
    </Link>
  );
}
