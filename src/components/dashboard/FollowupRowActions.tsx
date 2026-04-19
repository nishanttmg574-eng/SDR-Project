"use client";

import Link from "next/link";
import { useTransition } from "react";
import { snoozeFollowupAction } from "@/lib/actions";

export function FollowupRowActions({ accountId }: { accountId: string }) {
  const [pending, startTransition] = useTransition();

  function onSnooze(days: number) {
    startTransition(async () => {
      await snoozeFollowupAction(accountId, days);
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
      <Link
        href={`/accounts/${accountId}?tab=interactions&new=1`}
        className="text-blue-600 hover:underline"
      >
        Log interaction
      </Link>
      <button
        type="button"
        onClick={() => onSnooze(7)}
        disabled={pending}
        className="text-neutral-600 hover:text-neutral-900 hover:underline disabled:opacity-50"
        title="Push follow-up by 1 week"
      >
        {pending ? "Pushing…" : "Snooze +1w"}
      </button>
    </div>
  );
}
