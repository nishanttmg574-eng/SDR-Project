"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import type { BulkFilter, JobState } from "@/lib/scoring-types";

type StatusResponse = JobState | { status: "idle" };

const FILTER_LABELS: Record<BulkFilter, string> = {
  unscored: "Unscored only",
  all: "All accounts (re-score)",
  "low-confidence": "Low-confidence only",
};

const LIMITS: Array<number | "all"> = [10, 25, 50, 100, "all"];
const WORKERS = [2, 3, 5] as const;

export function BulkScoringModal({
  open,
  onClose,
  apiKeyConfigured,
}: {
  open: boolean;
  onClose: () => void;
  apiKeyConfigured: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<BulkFilter>("unscored");
  const [limit, setLimit] = useState<number | "all">(10);
  const [workers, setWorkers] = useState<number>(3);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = status && "id" in status && (status.status === "running" || status.status === "cancelling");
  const isTerminal = status && "id" in status && (status.status === "done" || status.status === "error");

  useEffect(() => {
    if (!open) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setStatus(null);
      setStartError(null);
      setCancelling(false);
      return;
    }
    // Fetch current status on open so an already-running job is visible.
    void poll();
    pollRef.current = setInterval(poll, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function poll(): Promise<void> {
    try {
      const res = await fetch("/api/score/status", { cache: "no-store" });
      const data: StatusResponse = await res.json();
      setStatus(data);
      if ("status" in data && (data.status === "done" || data.status === "error")) {
        router.refresh();
      }
    } catch {
      // ignore transient polling errors
    }
  }

  async function start(): Promise<void> {
    setStartError(null);
    try {
      const res = await fetch("/api/score/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter, limit, workers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStartError(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
        return;
      }
      await poll();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    }
  }

  async function cancel(): Promise<void> {
    setCancelling(true);
    try {
      await fetch("/api/score/cancel", { method: "POST" });
    } catch {
      // ignore — next poll reflects state
    }
  }

  const jobState = status && "id" in status ? status : null;

  return (
    <Modal open={open} onClose={onClose} title="Score accounts with AI" widthClass="max-w-xl">
      {!apiKeyConfigured && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> in .env first.
        </div>
      )}

      {!isRunning && !isTerminal && (
        <div className="space-y-4">
          <Field label="Which accounts">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FILTER_LABELS) as BulkFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`chip ${filter === f ? "chip-active" : ""}`}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Limit">
            <div className="flex flex-wrap gap-2">
              {LIMITS.map((n) => (
                <button
                  key={String(n)}
                  type="button"
                  onClick={() => setLimit(n)}
                  className={`chip ${limit === n ? "chip-active" : ""}`}
                >
                  {n === "all" ? "All" : n}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Parallel workers">
            <div className="flex flex-wrap gap-2">
              {WORKERS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWorkers(w)}
                  className={`chip ${workers === w ? "chip-active" : ""}`}
                >
                  {w}
                </button>
              ))}
            </div>
          </Field>

          {startError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
              {startError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={start}
              disabled={!apiKeyConfigured}
            >
              Start
            </button>
          </div>
        </div>
      )}

      {jobState && (isRunning || isTerminal) && (
        <ProgressView
          job={jobState}
          onCancel={cancel}
          cancelling={cancelling}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function ProgressView({
  job,
  onCancel,
  cancelling,
  onClose,
}: {
  job: JobState;
  onCancel: () => void;
  cancelling: boolean;
  onClose: () => void;
}) {
  const pct = job.total === 0 ? 0 : Math.min(100, Math.round((job.completed / job.total) * 100));
  const terminal = job.status === "done" || job.status === "error";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-neutral-700">
            {job.status === "cancelling"
              ? "Cancelling…"
              : job.status === "done"
              ? "Done"
              : job.status === "error"
              ? "Failed"
              : "Scoring…"}
          </div>
          <div className="text-xs tabular-nums text-neutral-500">
            {job.completed}/{job.total}
          </div>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className={`h-full ${job.status === "error" ? "bg-red-500" : "bg-blue-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat label="Low confidence" value={job.lowConfidence} tone={job.lowConfidence > 0 ? "amber" : "neutral"} />
        <Stat label="Failed" value={job.failed} tone={job.failed > 0 ? "red" : "neutral"} />
        <Stat
          label="Workers"
          value={`${job.workers} / ${FILTER_LABEL_SHORT[job.filter]}`}
          tone="neutral"
        />
      </div>

      {job.errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          {job.errorMessage}
        </div>
      )}

      {job.recentFailures.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-neutral-600">
            Recent failures ({job.recentFailures.length})
          </summary>
          <ul className="mt-1 list-inside list-disc text-xs text-neutral-700">
            {job.recentFailures.slice(0, 10).map((f) => (
              <li key={f.accountId}>
                <span className="font-medium">{f.name}</span> — {f.error}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {!terminal ? (
          <button
            type="button"
            className="btn-danger"
            onClick={onCancel}
            disabled={cancelling || job.status === "cancelling"}
          >
            {cancelling || job.status === "cancelling" ? "Cancelling…" : "Cancel"}
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}

const FILTER_LABEL_SHORT: Record<BulkFilter, string> = {
  unscored: "unscored",
  all: "all",
  "low-confidence": "low-conf",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-neutral-700">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "amber" | "red";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-700"
      : tone === "red"
      ? "text-red-700"
      : "text-neutral-900";
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-sm font-medium tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
