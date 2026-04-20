import { listAccounts } from "@/lib/accounts";
import { STAGES, TIERS, type Stage, type Tier } from "@/lib/config";
import { hasApiKey } from "@/lib/anthropic";
import { AccountsFilters } from "@/components/AccountsFilters";
import { AccountsTable } from "@/components/AccountsTable";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { FollowupsSection } from "@/components/dashboard/FollowupsSection";
import { AccountsHeader } from "@/components/ai/AccountsHeader";

type SP = { [key: string]: string | string[] | undefined };

function pickStage(v: string | undefined): Stage | undefined {
  return v && (STAGES as readonly string[]).includes(v) ? (v as Stage) : undefined;
}
function pickTier(v: string | undefined): Tier | "unscored" | undefined {
  if (v === "unscored") return "unscored";
  return v && (TIERS as readonly string[]).includes(v) ? (v as Tier) : undefined;
}
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AccountsListPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const accounts = listAccounts({
    q: first(sp.q),
    stage: pickStage(first(sp.stage)),
    tier: pickTier(first(sp.tier)),
    needsReview: first(sp.needs_review) === "1",
    hasFollowup: first(sp.has_followup) === "1",
    touched: first(sp.touched) === "1",
  });
  const apiKeyConfigured = hasApiKey();

  return (
    <div className="space-y-6">
      <StatsCards />
      <FollowupsSection />

      <AccountsHeader count={accounts.length} apiKeyConfigured={apiKeyConfigured} />
      <AccountsFilters />
      <AccountsTable accounts={accounts} />
    </div>
  );
}
