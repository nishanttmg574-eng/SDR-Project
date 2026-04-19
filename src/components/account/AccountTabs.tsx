import Link from "next/link";

type Tab = "details" | "interactions" | "prospects" | "followup";

const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "interactions", label: "Interactions" },
  { id: "prospects", label: "Prospects" },
  { id: "followup", label: "Follow-up" },
];

export function AccountTabs({
  basePath,
  active,
  counts,
}: {
  basePath: string;
  active: Tab;
  counts: { interactions: number; prospects: number; followup: boolean };
}) {
  return (
    <div className="border-b border-neutral-200">
      <nav className="flex gap-1">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          const href = tab.id === "details" ? basePath : `${basePath}?tab=${tab.id}`;
          const badge = badgeFor(tab.id, counts);
          return (
            <Link
              key={tab.id}
              href={href}
              replace
              scroll={false}
              className={
                "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm " +
                (isActive
                  ? "border-blue-600 font-medium text-blue-700"
                  : "border-transparent text-neutral-600 hover:text-neutral-900")
              }
            >
              {tab.label}
              {badge !== null ? (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs tabular-nums text-neutral-600">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function badgeFor(
  tab: Tab,
  counts: { interactions: number; prospects: number; followup: boolean }
): string | number | null {
  if (tab === "interactions") return counts.interactions > 0 ? counts.interactions : null;
  if (tab === "prospects") return counts.prospects > 0 ? counts.prospects : null;
  if (tab === "followup") return counts.followup ? "•" : null;
  return null;
}

export type { Tab };
