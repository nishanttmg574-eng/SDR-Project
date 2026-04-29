import { AccountDetailForm } from "@/components/AccountDetailForm";
import { ScoringPanel } from "@/components/ai/ScoringPanel";
import { getAiReadiness } from "@/lib/ai-providers";
import { isScoreStale } from "@/lib/ai-metadata";
import { getSettings, isConfigured } from "@/lib/settings";
import type { Account } from "@/lib/types";

export function DetailsPanel({ account }: { account: Account }) {
  const settings = getSettings();
  const aiReadiness = getAiReadiness(settings);
  const settingsConfigured = isConfigured(settings);

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-medium text-neutral-800">Details</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Detail label="Website" value={account.website} isUrl />
          <Detail label="Industry" value={account.industry} />
          <Detail label="HQ location" value={account.location} />
          <Detail label="Headcount" value={account.headcount} />
        </dl>
      </section>

      {account.customFields && Object.keys(account.customFields).length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium text-neutral-800">Imported fields</h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {Object.entries(account.customFields).map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="truncate text-xs text-neutral-500">{key}</dt>
                <dd className="truncate text-neutral-900" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <ScoringPanel
        account={account}
        aiReadiness={aiReadiness}
        settingsConfigured={settingsConfigured}
        stale={isScoreStale(account, settings)}
      />

      <AccountDetailForm
        id={account.id}
        initialStage={account.stage}
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
      <dd className="min-w-0 break-words text-neutral-900">
        {value ? (
          isUrl ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="break-all text-blue-600 hover:underline"
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
