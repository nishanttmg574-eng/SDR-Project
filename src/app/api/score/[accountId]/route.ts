import { NextResponse } from "next/server";
import { getAccount, writeAiScore } from "@/lib/accounts";
import { getSettings } from "@/lib/settings";
import { scoreAccount } from "@/lib/scoring";
import { ApiKeyMissingError, hasApiKey } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  if (!hasApiKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 400 });
  }

  const account = getAccount(accountId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const settings = getSettings();
    const outcome = await scoreAccount(account, settings);
    writeAiScore(account.id, outcome);
    const refreshed = getAccount(account.id);
    if (outcome.ok) {
      return NextResponse.json({ ok: true, account: refreshed });
    }
    return NextResponse.json({ ok: false, error: outcome.error, account: refreshed });
  } catch (err) {
    if (err instanceof ApiKeyMissingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
