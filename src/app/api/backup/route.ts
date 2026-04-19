import { NextResponse } from "next/server";
import { getBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  const backup = getBackup();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `workspace-backup-${date}.json`;
  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
