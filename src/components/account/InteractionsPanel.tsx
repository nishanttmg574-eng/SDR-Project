"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CHANNEL_LABELS,
  CHANNELS,
  OUTCOME_LABELS,
  OUTCOMES,
  type Channel,
  type Interaction,
  type NewInteractionInput,
  type Outcome,
  type Prospect,
} from "@/lib/types";
import {
  clearFollowupAction,
  createInteractionAction,
  deleteInteractionAction,
  snoozeFollowupAction,
} from "@/lib/actions";
import { Modal } from "@/components/ui/Modal";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

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
      <div className="flex items-center justify-between">
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

type FollowupAction = "keep" | "clear" | "snooze-3" | "snooze-7" | "snooze-30";

const FOLLOWUP_CHOICES: { value: FollowupAction; label: string }[] = [
  { value: "keep", label: "Keep" },
  { value: "clear", label: "Clear" },
  { value: "snooze-3", label: "Push +3d" },
  { value: "snooze-7", label: "Push +1w" },
  { value: "snooze-30", label: "Push +30d" },
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
  const [followupAction, setFollowupAction] = useState<FollowupAction>(
    followupDate ? "clear" : "keep"
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: NewInteractionInput = {
      date,
      channel,
      outcome,
      person: person.trim() || undefined,
      notes: notes.trim() || undefined,
      nextStep: nextStep.trim() || undefined,
    };
    startTransition(async () => {
      try {
        await createInteractionAction(accountId, input);
        if (followupDate && followupAction !== "keep") {
          if (followupAction === "clear") {
            await clearFollowupAction(accountId);
          } else if (followupAction === "snooze-3") {
            await snoozeFollowupAction(accountId, 3);
          } else if (followupAction === "snooze-7") {
            await snoozeFollowupAction(accountId, 7);
          } else if (followupAction === "snooze-30") {
            await snoozeFollowupAction(accountId, 30);
          }
        }
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-neutral-700">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="input mt-1"
          />
        </label>
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
          onChange={(e) => setOutcome(e.target.value as Outcome)}
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
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <div className="text-sm text-neutral-700">
            Follow-up on{" "}
            <span className="font-medium text-neutral-900">
              {followupLabel(followupDate, todayIso())}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {FOLLOWUP_CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setFollowupAction(c.value)}
                className={`chip ${followupAction === c.value ? "chip-active" : ""}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
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
