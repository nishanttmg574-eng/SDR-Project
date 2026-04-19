import { listAccounts } from "@/lib/accounts";
import { STAGES, TIERS, type Stage, type Tier } from "@/lib/config";
import { AccountsFilters } from "@/components/AccountsFilters";
import { AccountsTable } from "@/components/AccountsTable";

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
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Accounts</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
        </p>
      </div>
      <AccountsFilters />
      <AccountsTable accounts={accounts} />
    </div>
  );
}
