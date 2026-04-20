import { randomUUID } from "node:crypto";
import {
  getAccount,
  listAccountIdsForScoring,
  writeAiScoresBatch,
  type ScoringWrite,
} from "./accounts";
import { getSettings } from "./settings";
import { scoreAccount } from "./scoring";
import type { BulkFilter, JobState } from "./scoring-types";

export type { BulkFilter, JobState } from "./scoring-types";

// Module singleton: one job at a time, localhost, single user.
// Tradeoff: Next.js dev-server HMR drops this state. Status polls flip to
// "idle" mid-run and the client interprets as done + refreshes. Acceptable
// for a localhost app. Upgrade path: persist to a scoring_jobs DB table.

const FLUSH_EVERY = 10;
const RECENT_FAILURES_CAP = 20;
const ALL_HARD_CAP = 2000;

let current: JobState | null = null;
let pendingWrites: Array<{ id: string; result: ScoringWrite }> = [];

export function getStatus(): JobState | { status: "idle" } {
  return current ?? { status: "idle" };
}

export function requestCancel(): void {
  if (current && current.status === "running") {
    current.cancelRequested = true;
    current.status = "cancelling";
  }
}

export function startJob(opts: {
  filter: BulkFilter;
  limit: number | "all";
  workers: number;
}): { jobId: string } | { error: string } {
  if (current && current.status === "running") {
    return { error: "A scoring job is already running." };
  }
  const limit = opts.limit === "all" ? ALL_HARD_CAP : Math.max(1, Math.min(500, opts.limit));
  const workers = Math.max(1, Math.min(5, opts.workers));
  const candidates = listAccountIdsForScoring(opts.filter, limit);

  const job: JobState = {
    id: randomUUID(),
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    total: candidates.length,
    completed: 0,
    failed: 0,
    lowConfidence: 0,
    cancelRequested: false,
    filter: opts.filter,
    limit,
    workers,
    errorMessage: null,
    recentFailures: [],
  };
  current = job;
  pendingWrites = [];

  // Fire and forget. Never await — HTTP response returns immediately.
  void run(job, candidates);

  return { jobId: job.id };
}

function flush(): void {
  if (pendingWrites.length === 0) return;
  const batch = pendingWrites;
  pendingWrites = [];
  try {
    writeAiScoresBatch(batch);
  } catch (err) {
    // Put them back — next flush will retry. Log for visibility.
    pendingWrites = batch.concat(pendingWrites);
    console.error("[scoring-job] batch write failed:", err);
  }
}

async function run(
  job: JobState,
  candidates: Array<{ id: string; name: string }>
): Promise<void> {
  try {
    if (candidates.length === 0) {
      job.status = "done";
      job.finishedAt = new Date().toISOString();
      return;
    }
    const settings = getSettings();
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (!job.cancelRequested) {
        const i = cursor++;
        if (i >= candidates.length) return;
        const { id, name } = candidates[i];
        const account = getAccount(id);
        if (!account) {
          // Deleted mid-flight; count as completed (skip).
          job.completed++;
          continue;
        }
        const outcome = await scoreAccount(account, settings);
        pendingWrites.push({ id, result: outcome });
        job.completed++;
        if (outcome.ok) {
          if (outcome.confidence === "low") job.lowConfidence++;
        } else {
          job.failed++;
          if (job.recentFailures.length < RECENT_FAILURES_CAP) {
            job.recentFailures.push({ accountId: id, name, error: outcome.error });
          }
        }
        if (pendingWrites.length >= FLUSH_EVERY) flush();
      }
    };

    const workers = Array.from({ length: job.workers }, () => worker());
    await Promise.all(workers);
    flush();
    job.status = "done";
    job.finishedAt = new Date().toISOString();
  } catch (err) {
    flush();
    job.status = "error";
    job.errorMessage = err instanceof Error ? err.message : String(err);
    job.finishedAt = new Date().toISOString();
  }
}
