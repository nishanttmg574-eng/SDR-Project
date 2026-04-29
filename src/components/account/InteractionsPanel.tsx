"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CHANNEL_LABELS,
  CHANNELS,
  OUTCOME_LABELS,
  OUTCOMES,
  type Channel,
  type InteractionDispositionInput,
  type InteractionDispositionType,
  type Interaction,
  type NewInteractionInput,
  type Outcome,
  type Prospect,
} from "@/lib/types";
import { addDaysIso, isDateOnly, todayIso } from "@/lib/dates";
import {
  createInteractionAction,
  deleteInteractionAction,
} from "@/lib/actions";
import { DateField } from "@/components/ui/DateField";
import { Modal } from "@/components/ui/Modal";

export function InteractionsPanel({
  accountId,
  interactions,
  prospects,
  openNew,
  followupDate,
}: {
  accountId: string;
  interactions: Interaction[];
  prospects: Prospect[];
  openNew: boolean;
  followupDate: string | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (openNew) {
      setModalOpen(true);
      const next = new URLSearchParams(params.toString());
      next.delete("new");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNew]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-800">
          Interactions
          <span className="ml-2 text-neutral-400">({interactions.length})</span>
        </h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setModalOpen(true)}
        >
          + Log interaction
        </button>
      </div>

      {interactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No interactions yet. Click <em>Log interaction</em> to add one.
        </div>
      ) : (
        <ol className="space-y-3">
          {interactions.map((i) => (
            <InteractionRow key={i.id} accountId={accountId} interaction={i} />
          ))}
        </ol>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Log interaction"
      >
        <InteractionForm
          accountId={accountId}
          prospects={prospects}
          followupDate={followupDate}
          onDone={() => setModalOpen(false)}
        />
      </Modal>
    </section>
  );
}

const OUTCOME_DOT: Record<Outcome, string> = {
  "no-answer": "bg-neutral-300",
  connected: "bg-blue-400",
  replied: "bg-indigo-400",
  meeting: "bg-green-500",
  objection: "bg-amber-500",
  dead: "bg-red-500",
};

function InteractionRow({
  accountId,
  interaction,
}: {
  accountId: string;
  interaction: Interaction;
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm("Delete this interaction? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteInteractionAction(accountId, interaction.id);
    });
  }

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
            interaction.outcome ? OUTCOME_DOT[interaction.outcome] : "bg-neutral-200"
          }`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span className="font-medium text-neutral-900">{interaction.date}</span>
            {interaction.channel ? (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                {CHANNEL_LABELS[interaction.channel]}
              </span>
            ) : null}
            {interaction.outcome ? (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                {OUTCOME_LABELS[interaction.outcome]}
              </span>
            ) : null}
            {interaction.person ? (
              <span>with {interaction.person}</span>
            ) : null}
          </div>
          {interaction.notes ? (
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-neutral-800">
              {interaction.notes}
            </p>
          ) : null}
          {interaction.nextStep ? (
            <p className="mt-1.5 text-sm">
              <span className="text-neutral-500">Next: </span>
              <span className="text-neutral-800">{interaction.nextStep}</span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </li>
  );
}

const DISPOSITION_CHOICES: {
  value: InteractionDispositionType;
  label: string;
}[] = [
  { value: "complete-clear", label: "Complete and clear" },
  { value: "no-answer-retry", label: "No answer and retry" },
  { value: "set-new-follow-up", label: "Set new follow-up" },
  { value: "meeting-booked", label: "Meeting booked" },
  { value: "mark-dead", label: "Mark dead" },
];

function followupLabel(iso: string, today: string): string {
  if (iso === today) return `${iso} (today)`;
  if (iso < today) {
    const [ay, am, ad] = today.split("-").map(Number);
    const [by, bm, bd] = iso.split("-").map(Number);
    const diff = Math.round(
      (Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000
    );
    return `${iso} (${diff}d overdue)`;
  }
  return iso;
}

function dispositionNeedsFollowup(
  disposition: InteractionDispositionType
): boolean {
  return (
    disposition === "no-answer-retry" ||
    disposition === "set-new-follow-up"
  );
}

function forcedOutcomeForDisposition(
  disposition: InteractionDispositionType
): Outcome | null {
  if (disposition === "no-answer-retry") return "no-answer";
  if (disposition === "meeting-booked") return "meeting";
  if (disposition === "mark-dead") return "dead";
  return null;
}

function InteractionForm({
  accountId,
  prospects,
  followupDate,
  onDone,
}: {
  accountId: string;
  prospects: Prospect[];
  followupDate: string | null;
  onDone: () => void;
}) {
  const [date, setDate] = useState(todayIso());
  const [channel, setChannel] = useState<Channel>("call");
  const [person, setPerson] = useState<string>("");
  const [outcome, setOutcome] = useState<Outcome>("no-answer");
  const [notes, setNotes] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [disposition, setDisposition] = useState<InteractionDispositionType>(
    followupDate ? "no-answer-retry" : "complete-clear"
  );
  const [followupTargetDate, setFollowupTargetDate] = useState(
    addDaysIso(todayIso(), 3)
  );
  const [followupReason, setFollowupReason] = useState(
    followupDate ? "Retry after no answer" : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onDispositionChange(next: InteractionDispositionType) {
    setDisposition(next);
    const forcedOutcome = forcedOutcomeForDisposition(next);
    if (forcedOutcome) setOutcome(forcedOutcome);
    if (next === "no-answer-retry" && !followupReason.trim()) {
      setFollowupReason("Retry after no answer");
    }
  }

  function onOutcomeChange(next: Outcome) {
    setOutcome(next);
    if (next === "meeting") setDisposition("meeting-booked");
    else if (next === "dead") setDisposition("mark-dead");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isDateOnly(date)) {
      setError("Interaction date must be a valid date (YYYY-MM-DD)");
      return;
    }
    if (dispositionNeedsFollowup(disposition)) {
      const today = todayIso();
      if (!isDateOnly(followupTargetDate)) {
        setError("Follow-up date must be a valid date (YYYY-MM-DD)");
        return;
      }
      if (followupTargetDate < today) {
        setError("Follow-up date cannot be in the past");
        return;
      }
      if (!followupReason.trim()) {
        setError("Follow-up reason is required");
        return;
      }
    }
    const submittedOutcome = forcedOutcomeForDisposition(disposition) ?? outcome;
    const input: NewInteractionInput = {
      date,
      channel,
      outcome: submittedOutcome,
      person: person.trim() || undefined,
      notes: notes.trim() || undefined,
      nextStep: nextStep.trim() || undefined,
    };
    const dispositionInput: InteractionDispositionInput = {
      type: disposition,
      followupDate: dispositionNeedsFollowup(disposition)
        ? followupTargetDate
        : undefined,
      followupReason: dispositionNeedsFollowup(disposition)
        ? followupReason.trim()
        : undefined,
    };
    startTransition(async () => {
      try {
        await createInteractionAction(accountId, input, dispositionInput);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DateField
          label="Date (YYYY-MM-DD)"
          value={date}
          onChange={setDate}
          invalid={!isDateOnly(date) && !!error}
          required
        />
        <label className="block text-sm">
          <span className="text-neutral-700">Channel</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            className="input mt-1"
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-neutral-700">Person</span>
        {prospects.length > 0 ? (
          <select
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="input mt-1"
          >
            <option value="">— none —</option>
            {prospects.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
                {p.title ? ` · ${p.title}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            placeholder="No prospects yet — type a name"
            className="input mt-1"
          />
        )}
      </label>

      <label className="block text-sm">
        <span className="text-neutral-700">Outcome</span>
        <select
          value={outcome}
          onChange={(e) => onOutcomeChange(e.target.value as Outcome)}
          disabled={forcedOutcomeForDisposition(disposition) !== null}
          className="input mt-1"
        >
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABELS[o]}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-neutral-700">Disposition</span>
        <select
          value={disposition}
          onChange={(e) =>
            onDispositionChange(e.target.value as InteractionDispositionType)
          }
          className="input mt-1"
        >
          {DISPOSITION_CHOICES.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>

      {dispositionNeedsFollowup(disposition) ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateField
              label="Follow-up date (YYYY-MM-DD)"
              value={followupTargetDate}
              onChange={setFollowupTargetDate}
              invalid={
                (!isDateOnly(followupTargetDate) ||
                  followupTargetDate < todayIso()) &&
                !!error
              }
              min={todayIso()}
              required
            />
            <label className="block text-sm">
              <span className="text-neutral-700">Follow-up reason</span>
              <input
                type="text"
                value={followupReason}
                onChange={(e) => setFollowupReason(e.target.value)}
                className="input mt-1"
                aria-invalid={!followupReason.trim() && error ? true : undefined}
              />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[3, 7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setFollowupTargetDate(addDaysIso(todayIso(), days))}
                className="chip"
              >
                +{days}d
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="text-neutral-700">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="input mt-1"
        />
      </label>

      <label className="block text-sm">
        <span className="text-neutral-700">Next step</span>
        <input
          type="text"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="e.g. Send one-pager by Friday"
          className="input mt-1"
        />
      </label>

      {followupDate ? (
        <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700">
          Existing follow-up{" "}
          <span className="font-medium text-neutral-900">
            {followupLabel(followupDate, todayIso())}
          </span>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {pending ? "Saving interaction." : ""}
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save interaction"}
        </button>
      </div>
    </form>
  );
}
