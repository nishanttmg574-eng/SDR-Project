import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount } from "@/lib/accounts";
import { AccountDetailForm } from "@/components/AccountDetailForm";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = getAccount(id);
  if (!account) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-baseline justify-between">
        <div>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Accounts
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{account.name}</h1>
        </div>
        <DeleteAccountButton id={account.id} name={account.name} />
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-medium text-neutral-800">Details</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Detail label="Website" value={account.website} isUrl />
          <Detail label="Industry" value={account.industry} />
          <Detail label="HQ location" value={account.location} />
          <Detail label="Headcount" value={account.headcount} />
        </dl>
      </section>

      <AccountDetailForm
        id={account.id}
        initialStage={account.stage}
        initialHumanTier={account.humanTier}
        initialNotes={account.notes}
      />
    </div>
  );
}

function Detail({
  label,
  value,
  isUrl,
}: {
  label: string;
  value: string | null;
  isUrl?: boolean;
}) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">
        {value ? (
          isUrl ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </dd>
    </>
  );
}
