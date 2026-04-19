import { AccountDetailForm } from "@/components/AccountDetailForm";
import type { Account } from "@/lib/types";

export function DetailsPanel({ account }: { account: Account }) {
  return (
    <div className="space-y-8">
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
