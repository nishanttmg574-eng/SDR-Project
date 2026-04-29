"use client";

import { useState, useTransition } from "react";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/config";
import { updateAccountAction } from "@/lib/actions";

type NotesStatus = "saved" | "saving" | "error";

export function AccountDetailForm({
  id,
  initialStage,
  initialNotes,
}: {
  id: string;
  initialStage: Stage;
  initialNotes: string;
}) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [stageError, setStageError] = useState<string | null>(null);
  const [notesStatus, setNotesStatus] = useState<NotesStatus>("saved");
  const [notesError, setNotesError] = useState<string | null>(null);
  const [stagePending, startStageTransition] = useTransition();

  function saveStage(nextStage: Stage) {
    const previousStage = stage;
    setStage(nextStage);
    setStageError(null);
    startStageTransition(async () => {
      try {
        await updateAccountAction(id, { stage: nextStage });
      } catch (err) {
        setStage(previousStage);
        setStageError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function saveNotes(nextNotes = notes) {
    if (nextNotes === savedNotes || notesStatus === "saving") return;
    setNotesStatus("saving");
    setNotesError(null);
    try {
      await updateAccountAction(id, { notes: nextNotes });
      setSavedNotes(nextNotes);
      setNotesStatus("saved");
    } catch (err) {
      setNotesStatus("error");
      setNotesError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <SaveIndicator status={notesStatus} stagePending={stagePending} />
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-800">Stage</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => saveStage(s)}
              aria-pressed={stage === s}
              disabled={stagePending}
              className={`chip ${stage === s ? "chip-active" : ""}`}
            >
              {STAGE_LABELS[s]}
            </button>
          ))}
        </div>
        {stageError ? (
          <p
            role="alert"
            className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {stageError}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-800">Notes</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Saved when you click away from the box.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== savedNotes) {
              void saveNotes(notes);
            }
          }}
          rows={8}
          className="input mt-2"
          aria-invalid={notesStatus === "error" || undefined}
          aria-describedby={notesStatus === "error" ? "notes-save-error" : undefined}
        />
        {notesStatus === "error" ? (
          <div
            id="notes-save-error"
            role="alert"
            className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <div>{notesError ?? "Notes could not be saved."}</div>
            <button
              type="button"
              onClick={() => void saveNotes(notes)}
              className="mt-2 text-xs font-medium text-red-800 underline"
            >
              Retry save
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SaveIndicator({
  status,
  stagePending,
}: {
  status: NotesStatus;
  stagePending: boolean;
}) {
  if (status === "saving" || stagePending) {
    return (
      <span aria-live="polite" className="text-xs text-neutral-500">
        Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span aria-live="polite" className="text-xs text-red-700">
        Save failed
      </span>
    );
  }
  return (
    <span aria-live="polite" className="text-xs text-green-700">
      All changes saved
    </span>
  );
}
