import { randomUUID } from "node:crypto";
import { db } from "./db";
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
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(INSERT_SQL).run({
    id,
    account_id: accountId,
    date: input.date,
    channel: input.channel ?? null,
    person: input.person?.trim() || null,
    outcome: input.outcome ?? null,
    notes: input.notes?.trim() ?? "",
    next_step: input.nextStep?.trim() || null,
    created_at: now,
  });
  return id;
}

export function deleteInteraction(id: string): void {
  db.prepare("DELETE FROM interactions WHERE id = ?").run(id);
}
