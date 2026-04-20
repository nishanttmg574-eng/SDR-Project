import { NextResponse } from "next/server";
import { requestCancel } from "@/lib/scoring-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  requestCancel();
  return NextResponse.json({ ok: true });
}
