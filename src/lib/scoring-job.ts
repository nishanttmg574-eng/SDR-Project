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

const FLUSH_EVERY = 10;
const RECENT_FAILURES_CAP = 20;
const ALL_HARD_CAP = 2000;
const MAX_TRANSIENT_RETRIES = 2;

let current: JobState | null = null;
let currentAbortController: AbortController | null = null;

export function getStatus(): JobState | { status: "idle" } {
  return current ?? { status: "idle" };
}

export function requestCancel(): void {
  if (current && (current.status === "running" || current.status === "cancelling")) {
    current.cancelRequested = true;
    current.status = "cancelling";
    currentAbortController?.abort();
  }
}

export function startJob(opts: {
  filter: BulkFilter;
  limit: number | "all";
  workers: number;
  includeHumanVerified?: boolean;
}): { jobId: string } | { error: string } {
  if (current && (current.status === "running" || current.status === "cancelling")) {
    return { error: "A scoring job is already running." };
  }
  const limit = opts.limit === "all" ? ALL_HARD_CAP : Math.max(1, Math.min(500, opts.limit));
  const workers = Math.max(1, Math.min(5, opts.workers));
  const includeHumanVerified = opts.includeHumanVerified === true;
  const candidates = listAccountIdsForScoring(opts.filter, limit, {
    includeHumanVerified,
  });

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
    includeHumanVerified,
    errorMessage: null,
    recentFailures: [],
  };
  current = job;
  currentAbortController = new AbortController();

  void run(job, candidates, currentAbortController);

  return { jobId: job.id };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function retryDelayMs(attempt: number, retryAfterMs?: number | null): number {
  if (retryAfterMs && retryAfterMs > 0) return Math.min(retryAfterMs, 30_000);
  const base = 500 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(base + jitter, 10_000);
}

async function scoreWithTransientRetry(
  account: NonNullable<ReturnType<typeof getAccount>>,
  settings: ReturnType<typeof getSettings>,
  signal: AbortSignal
): Promise<ScoringWrite> {
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    const outcome = await scoreAccount(account, settings, { signal });
    if (
      outcome.ok ||
      outcome.errorType !== "provider" ||
      !outcome.transient ||
      signal.aborted ||
      attempt === MAX_TRANSIENT_RETRIES
    ) {
      return outcome;
    }
    await sleep(retryDelayMs(attempt, outcome.retryAfterMs), signal);
  }
  return {
    ok: false,
    error: "Transient provider failure after retries",
    errorType: "provider",
    rawResponse: null,
  };
}

function flushPending(
  pendingWrites: Array<{ id: string; result: ScoringWrite }>
): void {
  if (pendingWrites.length === 0) return;
  const batch = pendingWrites.splice(0, pendingWrites.length);
  try {
    writeAiScoresBatch(batch);
  } catch (err) {
    pendingWrites.unshift(...batch);
    throw err;
  }
}

async function run(
  job: JobState,
  candidates: Array<{ id: string; name: string }>,
  abortController: AbortController
): Promise<void> {
  const pendingWrites: Array<{ id: string; result: ScoringWrite }> = [];
  let finalWriteError: string | null = null;

  try {
    if (candidates.length === 0) {
      job.status = "done";
      job.finishedAt = new Date().toISOString();
      return;
    }
    const settings = getSettings();
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (!job.cancelRequested && !abortController.signal.aborted) {
        const i = cursor++;
        if (i >= candidates.length) return;
        const { id, name } = candidates[i];
        const account = getAccount(id);
        if (!account) {
          job.completed++;
          continue;
        }
        const outcome = await scoreWithTransientRetry(
          account,
          settings,
          abortController.signal
        );
        if (job.cancelRequested && abortController.signal.aborted) return;
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
        if (pendingWrites.length >= FLUSH_EVERY) {
          try {
            flushPending(pendingWrites);
          } catch (err) {
            finalWriteError = err instanceof Error ? err.message : String(err);
          }
        }
      }
    };

    const workers = Array.from({ length: job.workers }, () => worker());
    await Promise.all(workers);

    try {
      flushPending(pendingWrites);
    } catch (err) {
      finalWriteError = err instanceof Error ? err.message : String(err);
    }

    if (finalWriteError) {
      job.status = "error";
      job.errorMessage = `Final score writes failed: ${finalWriteError}`;
    } else if (job.cancelRequested) {
      job.status = "cancelled";
    } else {
      job.status = "done";
    }
    job.finishedAt = new Date().toISOString();
  } catch (err) {
    try {
      flushPending(pendingWrites);
    } catch (writeErr) {
      finalWriteError = writeErr instanceof Error ? writeErr.message : String(writeErr);
    }
    job.status = "error";
    job.errorMessage = finalWriteError
      ? `Final score writes failed: ${finalWriteError}`
      : err instanceof Error
        ? err.message
        : String(err);
    job.finishedAt = new Date().toISOString();
  } finally {
    if (current?.id === job.id) {
      currentAbortController = null;
    }
  }
}
