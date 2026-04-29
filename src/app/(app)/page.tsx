import { listAccountsPage } from "@/lib/accounts";
import { STAGES, TIERS, type Stage, type Tier } from "@/lib/config";
import { getAiReadiness } from "@/lib/ai-providers";
import { getSettings } from "@/lib/settings";
import { AccountsFilters } from "@/components/AccountsFilters";
import { AccountsPagination } from "@/components/AccountsPagination";
import { AccountsTable } from "@/components/AccountsTable";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { FollowupsSection } from "@/components/dashboard/FollowupsSection";
import {
  OverdueFollowupsStrip,
  PriorityQueueSection,
} from "@/components/dashboard/MorningQueue";
import { AccountsHeader } from "@/components/ai/AccountsHeader";

type SP = { [key: string]: string | string[] | undefined };

function pickStage(v: string | undefined): Stage | undefined {
  return v && (STAGES as readonly string[]).includes(v) ? (v as Stage) : undefined;
}
function pickTier(v: string | undefined): Tier | "unscored" | undefined {
  if (v === "unscored") return "unscored";
  return v && (TIERS as readonly string[]).includes(v) ? (v as Tier) : undefined;
}
function pickFollowupBucket(v: string | undefined): "due" | "scheduled" | undefined {
  return v === "due" || v === "scheduled" ? v : undefined;
}
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function pickPage(v: string | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export default async function AccountsListPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const accountPage = listAccountsPage(
    {
      q: first(sp.q),
      stage: pickStage(first(sp.stage)),
      tier: pickTier(first(sp.tier)),
      needsReview: first(sp.needs_review) === "1",
      hasFollowup: first(sp.has_followup) === "1",
      followupBucket: pickFollowupBucket(first(sp.followup)),
      touched: first(sp.touched) === "1",
      staleTier12: first(sp.stale) === "1",
    },
    {
      page: pickPage(first(sp.page)),
    }
  );
  const settings = getSettings();
  const aiReadiness = getAiReadiness(settings);

  return (
    <div className="space-y-6">
      <OverdueFollowupsStrip />
      <AccountsHeader
        filteredCount={accountPage.filteredCount}
        totalCount={accountPage.totalCount}
        aiReadiness={aiReadiness}
      />
      <AccountsFilters />
      <AccountsTable
        accounts={accountPage.accounts}
        totalCount={accountPage.totalCount}
      />
      <AccountsPagination page={accountPage} />
      <PriorityQueueSection />
      <StatsCards />
      <FollowupsSection />
    </div>
  );
}
