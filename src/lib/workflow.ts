import { getAccount, updateAccount } from "./accounts";
import { db } from "./db";
import { assertDateOnlyOnOrAfter, todayIso } from "./dates";
import { clearFollowup, setFollowup } from "./followups";
import { createInteraction } from "./interactions";
import type { Stage } from "./config";
import type {
  InteractionDispositionInput,
  NewInteractionInput,
  Outcome,
} from "./types";

function terminalStage(stage: Stage): boolean {
  return stage === "meeting" || stage === "dead";
}

function normalizeDispositionInput(
  input: NewInteractionInput,
  disposition?: InteractionDispositionInput
): NewInteractionInput {
  if (!disposition) return input;
  if (disposition.type === "no-answer-retry") {
    return { ...input, outcome: "no-answer" };
  }
  if (disposition.type === "meeting-booked") {
    return { ...input, outcome: "meeting" };
  }
  if (disposition.type === "mark-dead") {
    return { ...input, outcome: "dead" };
  }
  return input;
}

function requiredFollowupPatch(disposition: InteractionDispositionInput): {
  date: string;
  reason: string;
} {
  const date = assertDateOnlyOnOrAfter(
    disposition.followupDate ?? "",
    todayIso(),
    "Follow-up date"
  );
  const reason = disposition.followupReason?.trim() ?? "";
  if (!reason) throw new Error("Follow-up reason is required");
  return { date, reason };
}

function stageAfterInteraction(
  currentStage: Stage,
  outcome: Outcome | undefined,
  disposition?: InteractionDispositionInput
): Stage {
  let nextStage = currentStage;

  if (disposition?.type === "complete-clear" && nextStage === "followup") {
    nextStage = "working";
  }

  if (
    (disposition?.type === "no-answer-retry" ||
      disposition?.type === "set-new-follow-up") &&
    !terminalStage(nextStage)
  ) {
    nextStage = "followup";
  }

  if (outcome === "meeting") return "meeting";
  if (outcome === "dead") return "dead";
  if (nextStage === "new" && outcome) return "working";

  return nextStage;
}

export function recordInteractionWithDisposition(
  accountId: string,
  input: NewInteractionInput,
  disposition?: InteractionDispositionInput
): string {
  const run = db.transaction(() => {
    const account = getAccount(accountId);
    if (!account) throw new Error("Account not found");

    const clean = normalizeDispositionInput(input, disposition);
    const interactionId = createInteraction(accountId, clean);

    if (disposition?.type === "complete-clear") {
      clearFollowup(accountId);
    } else if (
      disposition?.type === "no-answer-retry" ||
      disposition?.type === "set-new-follow-up"
    ) {
      setFollowup(accountId, requiredFollowupPatch(disposition));
    } else if (
      disposition?.type === "meeting-booked" ||
      disposition?.type === "mark-dead"
    ) {
      clearFollowup(accountId);
    }

    const nextStage = stageAfterInteraction(
      account.stage,
      clean.outcome,
      disposition
    );
    if (nextStage !== account.stage) {
      updateAccount(accountId, { stage: nextStage });
    }

    return interactionId;
  });

  return run();
}
