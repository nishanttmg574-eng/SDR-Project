"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TIERS, type Tier } from "@/lib/config";
import { updateAccountAction } from "@/lib/actions";
import type { Account } from "@/lib/types";
import { ConfidenceDot } from "./ConfidenceDot";
import { HumanVerifiedBadge } from "./HumanVerifiedBadge";

function linkedinSearchUrl(name: string): string {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(name)}`;
}

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function ScoringPanel({
  account,
  apiKeyConfigured,
  settingsConfigured,
}: {
  account: Account;
  apiKeyConfigured: boolean;
  settingsConfigured: boolean;
}) {
  const router = useRouter();
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [humanTier, setHumanTier] = useState<Tier | null>(account.humanTier);
  const [humanAt, setHumanAt] = useState<string | null>(account.humanVerifiedAt);
  const [pending, startTransition] = useTransition();

  async function runScore(): Promise<void> {
    if (scoring) return;
    setScoring(true);
    setScoreError(null);
    try {
      const res = await fetch(`/api/score/${account.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setScoreError(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
      } else if (data?.ok === false && typeof data?.error === "string") {
        setScoreError(data.error);
      }
      router.refresh();
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : String(err));
    } finally {
      setScoring(false);
    }
  }

  function setOverride(tier: Tier | null): void {
    setHumanTier(tier);
    setHumanAt(tier === null ? null : new Date().toISOString());
    startTransition(async () => {
      await updateAccountAction(account.id, { humanTier: tier });
    });
  }

  const evidence = account.aiEvidence;
  const aiScored = !!account.aiTier;
  const hasHuman = humanTier !== null;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-800">AI scoring</h2>
        <div className="flex items-center gap-2">
          <a
            href={linkedinSearchUrl(account.name)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Verify on LinkedIn ↗
          </a>
          <button
            type="button"
            className="btn-secondary"
            disabled={scoring || !apiKeyConfigured}
            onClick={runScore}
          >
            {scoring ? "Researching…" : aiScored ? "Re-score" : "Research & score"}
          </button>
        </div>
      </div>

      {!apiKeyConfigured && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> in{" "}
          <code className="font-mono text-xs">.env</code> to enable scoring.
        </div>
      )}

      {apiKeyConfigured && !settingsConfigured && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Fill in company description and tier definitions in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          first — AI will score more accurately.
        </div>
      )}

      {scoreError && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {scoreError}
        </div>
      )}

      {/* Proposed tier row */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">AI proposal</div>
          <div className="mt-1 flex items-center gap-2">
            {aiScored ? (
              <>
                <span className="text-lg font-semibold">Tier {account.aiTier}</span>
                <ConfidenceDot confidence={account.aiConfidence} />
                <span className="text-xs text-neutral-500">{account.aiConfidence}</span>
              </>
            ) : (
              <span className="text-sm text-neutral-400">Not yet scored</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {account.aiProposedAt
              ? `Proposed ${relativeDate(account.aiProposedAt)}`
              : account.scoringError
              ? "Last attempt failed"
              : ""}
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Your verified tier</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOverride(t)}
                disabled={pending}
                className={`chip ${humanTier === t ? "chip-active" : ""}`}
              >
                Tier {t}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOverride(null)}
              disabled={pending || !hasHuman}
              className="chip"
            >
              Clear override
            </button>
            <HumanVerifiedBadge at={humanAt} />
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            Your override sticks. Re-scoring never overwrites it.
          </div>
        </div>
      </div>

      {/* Scoring error card */}
      {account.scoringError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-medium">Scoring failed</div>
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-red-700">Raw response</summary>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-red-900">
              {account.scoringError}
            </pre>
          </details>
        </div>
      )}

      {/* Evidence */}
      {evidence && (
        <div className="mt-5 space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Evidence
          </div>
          <EvidenceRow
            label="Funding"
            summary={evidence.funding?.summary ?? null}
            source={evidence.funding?.source ?? null}
          />
          <EvidenceRow
            label="Hiring"
            summary={evidence.hiring?.summary ?? null}
            source={evidence.hiring?.source ?? null}
          />
          <div>
            <div className="text-xs font-medium text-neutral-600">Countries</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {evidence.countries.length === 0 ? (
                <span className="text-xs text-neutral-400">—</span>
              ) : (
                evidence.countries.map((c) => (
                  <span
                    key={c}
                    className="rounded bg-white px-2 py-0.5 text-xs text-neutral-700 ring-1 ring-neutral-200"
                  >
                    {c}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-600">Entity match</div>
            <div className="mt-1 flex items-center gap-2">
              <ConfidenceDot confidence={evidence.entity_match} size="sm" />
              <span className="text-xs text-neutral-700">
                {evidence.entity_match ?? "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Reasoning + gaps */}
      {(account.aiReasoning || account.aiGaps.length > 0) && (
        <div className="mt-4 space-y-3">
          {account.aiReasoning && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Reasoning
              </div>
              <p className="mt-1 text-sm text-neutral-800">{account.aiReasoning}</p>
            </div>
          )}
          {account.aiGaps.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Gaps
              </div>
              <ul className="mt-1 list-inside list-disc text-sm text-neutral-700">
                {account.aiGaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function EvidenceRow({
  label,
  summary,
  source,
}: {
  label: string;
  summary: string | null;
  source: string | null;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-neutral-600">{label}</div>
      <div className="mt-1 text-sm text-neutral-800">
        {summary ? (
          <>
            {summary}
            {source && (
              <>
                {" "}
                <a
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  source ↗
                </a>
              </>
            )}
          </>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </div>
    </div>
  );
}
