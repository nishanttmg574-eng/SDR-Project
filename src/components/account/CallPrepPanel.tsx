"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearCallPrepAction } from "@/lib/actions";
import type { AiReadiness } from "@/lib/ai-providers";
import type { Account } from "@/lib/types";

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

export function CallPrepPanel({
  account,
  aiReadiness,
  stale,
}: {
  account: Account;
  aiReadiness: AiReadiness;
  stale: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clearing, startClear] = useTransition();

  async function generate(): Promise<void> {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/callprep/${account.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
      } else if (data?.ok === false && typeof data?.error === "string") {
        setError(data.error);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function copy(): Promise<void> {
    if (!account.callPrep) return;
    try {
      await navigator.clipboard.writeText(account.callPrep);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function onClear(): void {
    if (!confirm("Clear the call prep?")) return;
    startClear(async () => {
      try {
        await clearCallPrepAction(account.id);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const hasCallPrep = !!account.callPrep;

  return (
    <section className="max-w-2xl space-y-5" aria-busy={generating || clearing}>
      <div>
        <h2 className="text-sm font-medium text-neutral-800">Call prep</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Generated from your notes, interactions, and prospects — not web search.
        </p>
      </div>

      <div aria-live="polite" className="sr-only">
        {generating ? "Generating call prep." : copied ? "Call prep copied." : ""}
      </div>

      {!aiReadiness.configured && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Set <code className="font-mono text-xs">{aiReadiness.envVar}</code> in{" "}
          <code className="font-mono text-xs">.env</code> to enable {aiReadiness.label} call prep.{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {!hasCallPrep ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm text-neutral-600">
            No call prep yet for {account.name}.
          </p>
          <QualityHint />
          <button
            type="button"
            onClick={generate}
            disabled={generating || !aiReadiness.configured}
            className="btn-primary mt-4"
          >
            {generating ? "Generating…" : "Generate call opener"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-neutral-500">
                Generated {relativeDate(account.callPrepDate)}
              </p>
              {account.callPrepMetadata && (
                <p className="text-xs text-neutral-500">
                  {account.callPrepMetadata.provider} / {account.callPrepMetadata.model}
                </p>
              )}
              {stale && (
                <div className="mt-1">
                  <p className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Stale - notes, prospects, interactions, evidence, or AI settings changed
                  </p>
                  <QualityHint className="mt-1" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generate}
                disabled={generating || !aiReadiness.configured}
                className="btn-secondary"
              >
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
              <button
                type="button"
                onClick={copy}
                disabled={generating}
                className="btn-secondary"
              >
                {copied ? "Copied ✓" : "Copy to clipboard"}
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={generating || clearing}
                className="btn-danger"
              >
                Clear
              </button>
            </div>
          </div>

          <pre className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-4 font-mono text-sm leading-relaxed text-neutral-800">
            {account.callPrep}
          </pre>
        </div>
      )}
    </section>
  );
}

function QualityHint({ className = "mt-2" }: { className?: string }) {
  return (
    <p className={`${className} text-xs text-neutral-500`}>
      Stronger prep comes from notes, prospects, recent interactions, and scored evidence.
    </p>
  );
}
