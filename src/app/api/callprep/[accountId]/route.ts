import { NextResponse } from "next/server";
import { getAccount, writeCallPrep } from "@/lib/accounts";
import { getSettings } from "@/lib/settings";
import { listInteractions } from "@/lib/interactions";
import { listProspects } from "@/lib/prospects";
import { generateCallPrep } from "@/lib/callprep";
import { getAiReadiness } from "@/lib/ai-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  const account = getAccount(accountId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const settings = getSettings();
    const readiness = getAiReadiness(settings);
    if (!readiness.configured) {
      return NextResponse.json({ error: `${readiness.envVar} not set` }, { status: 400 });
    }
    const interactions = listInteractions(account.id).slice(0, 3);
    const prospects = listProspects(account.id);
    const outcome = await generateCallPrep(account, settings, interactions, prospects);

    if (outcome.ok) {
      writeCallPrep(account.id, outcome.text, outcome.metadata);
      const refreshed = getAccount(account.id);
      return NextResponse.json({ ok: true, account: refreshed });
    }
    return NextResponse.json({ ok: false, error: outcome.error });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
