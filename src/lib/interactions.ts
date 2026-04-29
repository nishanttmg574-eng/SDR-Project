import { randomUUID } from "node:crypto";
import { recomputeAccountActivity, touchAccountInteractionActivity } from "./accounts";
import { db } from "./db";
import { assertDateOnly } from "./dates";
import {
  type Interaction,
  type InteractionRow,
  type NewInteractionInput,
  rowToInteraction,
} from "./types";

const LIST_SQL = `
  SELECT id, account_id, date, channel, person, outcome, notes, next_step, created_at
  FROM interactions
  WHERE account_id = ?
  ORDER BY date DESC, created_at DESC
`;

export function listInteractions(accountId: string): Interaction[] {
  const rows = db.prepare(LIST_SQL).all(accountId) as InteractionRow[];
  return rows.map(rowToInteraction);
}

const INSERT_SQL = `
  INSERT INTO interactions (id, account_id, date, channel, person, outcome, notes, next_step, created_at)
  VALUES (@id, @account_id, @date, @channel, @person, @outcome, @notes, @next_step, @created_at)
`;

export function createInteraction(
  accountId: string,
  input: NewInteractionInput
): string {
  const date = assertDateOnly(input.date, "Interaction date");
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(INSERT_SQL).run({
    id,
    account_id: accountId,
    date,
    channel: input.channel ?? null,
    person: input.person?.trim() || null,
    outcome: input.outcome ?? null,
    notes: input.notes?.trim() ?? "",
    next_step: input.nextStep?.trim() || null,
    created_at: now,
  });
  touchAccountInteractionActivity(accountId, date);
  return id;
}

export function deleteInteraction(id: string): void {
  const row = db
    .prepare("SELECT account_id FROM interactions WHERE id = ?")
    .get(id) as { account_id: string } | undefined;
  db.prepare("DELETE FROM interactions WHERE id = ?").run(id);
  if (row) recomputeAccountActivity(row.account_id);
}
