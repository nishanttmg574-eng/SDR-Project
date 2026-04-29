import Link from "next/link";
import { getDashboardStats } from "@/lib/stats";

export function StatsCards() {
  const stats = getDashboardStats();
  const overdueAlert = stats.followupsOverdue > 0;
  const staleAlert = stats.staleTier1And2Accounts > 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Card
        href="/?touched=1"
        label="Touches logged"
        value={stats.touchesLoggedLast7Days}
        sub={{ text: "Last 7 days", color: "text-neutral-500" }}
      />
      <Card
        href="/?touched=1"
        label="Accounts touched"
        value={stats.uniqueAccountsTouchedLast7Days}
        sub={{ text: "Unique accounts", color: "text-neutral-500" }}
      />
      <Card
        href="/?touched=1"
        label="Connects/replies"
        value={stats.connectsAndRepliesLast7Days}
        sub={{ text: "Last 7 days", color: "text-neutral-500" }}
      />
      <Card
        href="/?stage=meeting"
        label="Meetings booked"
        value={stats.meetingsBookedLast7Days}
        sub={{ text: "Last 7 days", color: "text-neutral-500" }}
      />
      <Card
        href="/?followup=due"
        label="Overdue follow-ups"
        value={stats.followupsOverdue}
        alert={overdueAlert}
        sub={
          overdueAlert
            ? { text: `${stats.followupsDue} due today or earlier`, color: "text-red-700" }
            : { text: "Clear", color: "text-neutral-500" }
        }
      />
      <Card
        href="/?stale=1"
        label="Stale Tier 1/2"
        value={stats.staleTier1And2Accounts}
        alert={staleAlert}
        sub={
          staleAlert
            ? { text: "Working/follow-up", color: "text-amber-700" }
            : { text: "Fresh", color: "text-neutral-500" }
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
