"use client";

import { useState, useTransition } from "react";
import { STAGES, STAGE_LABELS, TIERS, type Stage, type Tier } from "@/lib/config";
import { updateAccountAction } from "@/lib/actions";

export function AccountDetailForm({
  id,
  initialStage,
  initialHumanTier,
  initialNotes,
}: {
  id: string;
  initialStage: Stage;
  initialHumanTier: Tier | null;
  initialNotes: string;
}) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [humanTier, setHumanTier] = useState<Tier | null>(initialHumanTier);
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [pending, startTransition] = useTransition();

  function save(patch: { humanTier?: Tier | null; stage?: Stage; notes?: string }) {
    startTransition(async () => {
      await updateAccountAction(id, patch);
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <SaveIndicator pending={pending} />
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-800">Tier</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Your verified tier. Overrides any AI-proposed tier.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setHumanTier(t);
                save({ humanTier: t });
              }}
              className={`chip ${humanTier === t ? "chip-active" : ""}`}
            >
              Tier {t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setHumanTier(null);
              save({ humanTier: null });
            }}
            className={`chip ${humanTier === null ? "chip-active" : ""}`}
          >
            Unset
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-800">Stage</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStage(s);
                save({ stage: s });
              }}
              className={`chip ${stage === s ? "chip-active" : ""}`}
            >
              {STAGE_LABELS[s]}
            </button>
          ))}
        </div>
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
              setSavedNotes(notes);
              save({ notes });
            }
          }}
          rows={8}
          className="input mt-2"
        />
      </section>
    </div>
  );
}

function SaveIndicator({ pending }: { pending: boolean }) {
  if (pending) {
    return <span className="text-xs text-neutral-500">Saving…</span>;
  }
  return <span className="text-xs text-green-700">All changes saved</span>;
}
