import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { restoreBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body is not valid JSON" },
      { status: 400 }
    );
  }

  try {
    const counts = restoreBackup(payload);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during restore";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
