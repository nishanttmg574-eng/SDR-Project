import { NextResponse } from "next/server";
import { getAiReadiness } from "@/lib/ai-providers";
import { getSettings } from "@/lib/settings";
import { startJob, type BulkFilter } from "@/lib/scoring-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILTERS: BulkFilter[] = ["unscored", "all", "low-confidence"];
const WORKERS_ALLOWED = new Set([1, 2, 3, 5]);

export async function POST(req: Request) {
  const settings = getSettings();
  const readiness = getAiReadiness(settings);
  if (!readiness.configured) {
    return NextResponse.json({ error: `${readiness.envVar} not set` }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const filter = b.filter as BulkFilter;
  if (!FILTERS.includes(filter)) {
    return NextResponse.json({ error: `Invalid filter: ${String(filter)}` }, { status: 400 });
  }
  const limitRaw = b.limit;
  const limit: number | "all" =
    limitRaw === "all" ? "all" : typeof limitRaw === "number" ? limitRaw : 10;
  const workers = typeof b.workers === "number" ? b.workers : 2;
  if (!WORKERS_ALLOWED.has(workers)) {
    return NextResponse.json({ error: `Invalid workers: ${workers}` }, { status: 400 });
  }
  const includeHumanVerified = b.includeHumanVerified === true;

  const result = startJob({ filter, limit, workers, includeHumanVerified });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result);
}
