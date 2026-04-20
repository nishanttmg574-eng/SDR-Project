import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/accounts";
import { listInteractions } from "@/lib/interactions";
import { listProspects } from "@/lib/prospects";
import { hasApiKey } from "@/lib/anthropic";
import { AccountTabs, type Tab } from "@/components/account/AccountTabs";
import { DetailsPanel } from "@/components/account/DetailsPanel";
import { InteractionsPanel } from "@/components/account/InteractionsPanel";
import { ProspectsPanel } from "@/components/account/ProspectsPanel";
import { CallPrepPanel } from "@/components/account/CallPrepPanel";
import { FollowupPanel } from "@/components/account/FollowupPanel";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";

type SP = { [key: string]: string | string[] | undefined };

const VALID_TABS = ["details", "interactions", "prospects", "callprep", "followup"] as const;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function pickTab(v: string | undefined): Tab {
  return (VALID_TABS as readonly string[]).includes(v ?? "")
    ? (v as Tab)
    : "details";
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const account = getAccount(id);
  if (!account) notFound();

  const activeTab = pickTab(first(sp.tab));
  const openNew = first(sp.new) === "1";

  const interactions = listInteractions(account.id);
  const prospects = listProspects(account.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Accounts
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{account.name}</h1>
        </div>
        <DeleteAccountButton id={account.id} name={account.name} />
      </div>

      <AccountTabs
        basePath={`/accounts/${account.id}`}
        active={activeTab}
        counts={{
          interactions: interactions.length,
          prospects: prospects.length,
          callprep: !!account.callPrep,
          followup: !!account.followupDate,
        }}
      />

      <div className="pt-2">
        {activeTab === "details" ? <DetailsPanel account={account} /> : null}
        {activeTab === "interactions" ? (
          <InteractionsPanel
            accountId={account.id}
            interactions={interactions}
            prospects={prospects}
            openNew={openNew}
            followupDate={account.followupDate}
          />
        ) : null}
        {activeTab === "prospects" ? (
          <ProspectsPanel accountId={account.id} prospects={prospects} />
        ) : null}
        {activeTab === "callprep" ? (
          <CallPrepPanel account={account} apiKeyConfigured={hasApiKey()} />
        ) : null}
        {activeTab === "followup" ? <FollowupPanel account={account} /> : null}
      </div>
    </div>
  );
}
