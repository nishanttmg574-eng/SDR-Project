import Link from "next/link";
import { STAGE_LABELS } from "@/lib/config";
import type { Account } from "@/lib/types";
import { ConfidenceDot } from "@/components/ai/ConfidenceDot";
import { HumanVerifiedBadge } from "@/components/ai/HumanVerifiedBadge";

function industryLocation(a: Account): string {
  return [a.industry, a.location].filter(Boolean).join(" · ") || "—";
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

function TierCell({ account }: { account: Account }) {
  if (account.humanTier) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-medium">{account.humanTier}</span>
        <HumanVerifiedBadge at={account.humanVerifiedAt} />
      </span>
    );
  }
  if (account.aiTier) {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{account.aiTier}</span>
        <ConfidenceDot confidence={account.aiConfidence} size="sm" />
      </span>
    );
  }
  return <span className="text-neutral-400">—</span>;
}

export function AccountsTable({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500">
        No accounts match. Adjust the filters or{" "}
        <Link href="/accounts/new" className="text-blue-600 hover:underline">
          create one
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
          <tr>
            <Th>Name</Th>
            <Th>Tier</Th>
            <Th>Stage</Th>
            <Th>Industry / Location</Th>
            <Th className="text-right">Interactions</Th>
            <Th>Follow-up</Th>
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {accounts.map((a) => (
            <tr key={a.id} className="hover:bg-neutral-50">
              <Td>
                <Link
                  href={`/accounts/${a.id}`}
                  className="font-medium text-neutral-900 hover:text-blue-700"
                >
                  {a.name}
                </Link>
              </Td>
              <Td>
                <TierCell account={a} />
              </Td>
              <Td>{STAGE_LABELS[a.stage]}</Td>
              <Td>{industryLocation(a)}</Td>
              <Td className="text-right tabular-nums">{a.interactionCount}</Td>
              <Td>{a.followupDate ?? "—"}</Td>
              <Td className="text-neutral-500">{relativeDate(a.updatedAt)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-4 py-2 ${className}`}>{children}</th>;
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
