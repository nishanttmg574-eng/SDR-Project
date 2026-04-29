// Pure types — safe to import from client components.
// Keep in sync with JobState in scoring-job.ts.

export type BulkFilter = "unscored" | "all" | "low-confidence";
export type JobStatus = "idle" | "running" | "cancelling" | "cancelled" | "done" | "error";

export interface JobState {
  id: string;
  status: JobStatus;
  startedAt: string;
  finishedAt: string | null;
  total: number;
  completed: number;
  failed: number;
  lowConfidence: number;
  cancelRequested: boolean;
  filter: BulkFilter;
  limit: number;
  workers: number;
  includeHumanVerified: boolean;
  errorMessage: string | null;
  recentFailures: Array<{ accountId: string; name: string; error: string }>;
}
