"use client";

import { useState, useTransition } from "react";
import {
  clearFollowupAction,
  setFollowupAction,
  snoozeFollowupAction,
} from "@/lib/actions";
import { addDaysIso, isDateOnly, todayIso } from "@/lib/dates";
import type { Account } from "@/lib/types";
import { DateField } from "@/components/ui/DateField";

const QUICK_PICKS: { label: string; days: number }[] = [
  { label: "+3d", days: 3 },
  { label: "+1w", days: 7 },
  { label: "+2w", days: 14 },
  { label: "+30d", days: 30 },
  { label: "+60d", days: 60 },
  { label: "+90d", days: 90 },
];

const SNOOZE_PICKS: { label: string; days: number }[] = [
  { label: "+3d", days: 3 },
  { label: "+1w", days: 7 },
  { label: "+30d", days: 30 },
];

export function FollowupPanel({ account }: { account: Account }) {
  const hasFollowup = !!account.followupDate;
  const [date, setDate] = useState(account.followupDate ?? todayIso());
  const [reason, setReason] = useState(account.followupReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyQuick(days: number) {
    setDate(addDaysIso(todayIso(), days));
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const today = todayIso();
    if (!isDateOnly(date)) {
      setError("Follow-up date must be a valid date (YYYY-MM-DD)");
      return;
    }
    if (date < today) {
      setError("Follow-up date cannot be in the past");
      return;
    }
    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }
    startTransition(async () => {
      try {
        await setFollowupAction(account.id, { date, reason: reason.trim() });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function onClear() {
    if (!confirm("Clear the follow-up?")) return;
    startTransition(async () => {
      await clearFollowupAction(account.id);
      setReason("");
    });
  }

  function onSnooze(days: number) {
    startTransition(async () => {
      try {
        await snoozeFollowupAction(account.id, days);
        setDate((d) => addDaysIso(d < todayIso() ? todayIso() : d, days));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const savedLabel = hasFollowup
    ? `Saved: ${account.followupDate}`
    : "No follow-up set";
  const minFollowupDate = todayIso();
  const dateInvalid = !isDateOnly(date) || date < minFollowupDate;

  return (
    <section className="max-w-xl space-y-5">
      <div>
        <h2 className="text-sm font-medium text-neutral-800">Follow-up</h2>
        <p className="mt-0.5 text-xs text-neutral-500">{savedLabel}</p>
      </div>

      <form
        onSubmit={onSave}
        noValidate
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <DateField
          label="Date (YYYY-MM-DD)"
          value={date}
          onChange={setDate}
          invalid={dateInvalid && !!error}
          min={minFollowupDate}
        />

        <div className="flex flex-wrap gap-2">
          {QUICK_PICKS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyQuick(p.days)}
              className="chip"
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="block text-sm">
          <span className="text-neutral-700">Reason (required)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder='e.g. "Call after Q1 earnings"'
            className="input mt-1"
            aria-invalid={!reason.trim() && error ? true : undefined}
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <div aria-live="polite" className="sr-only">
          {pending ? "Saving follow-up." : ""}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Saving…" : hasFollowup ? "Update follow-up" : "Set follow-up"}
            </button>
            {hasFollowup ? (
              <button
                type="button"
                onClick={onClear}
                disabled={pending}
                className="btn-danger"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-medium text-neutral-800">Snooze</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Shifts the existing follow-up date forward.
          {!hasFollowup ? " Disabled — no follow-up set." : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SNOOZE_PICKS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onSnooze(p.days)}
              disabled={!hasFollowup || pending}
              className="chip disabled:cursor-not-allowed disabled:opacity-50"
            >
              Snooze {p.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
