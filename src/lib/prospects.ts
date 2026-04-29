import { randomUUID } from "node:crypto";
import { recomputeAccountActivity, touchAccountActivity } from "./accounts";
import { db } from "./db";
import {
  type NewProspectInput,
  type Prospect,
  type ProspectPatch,
  type ProspectRow,
  rowToProspect,
} from "./types";

export { parseLinkedInPaste } from "./linkedin";
export type { LinkedInParsed } from "./linkedin";

const LIST_SQL = `
  SELECT id, account_id, name, title, email, phone, linkedin, notes, created_at
  FROM prospects
  WHERE account_id = ?
  ORDER BY created_at ASC
`;

export function listProspects(accountId: string): Prospect[] {
  const rows = db.prepare(LIST_SQL).all(accountId) as ProspectRow[];
  return rows.map(rowToProspect);
}

const INSERT_SQL = `
  INSERT INTO prospects (id, account_id, name, title, email, phone, linkedin, notes, created_at)
  VALUES (@id, @account_id, @name, @title, @email, @phone, @linkedin, @notes, @created_at)
`;

export function createProspect(
  accountId: string,
  input: NewProspectInput
): string {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(INSERT_SQL).run({
    id,
    account_id: accountId,
    name,
    title: input.title?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    linkedin: input.linkedin?.trim() || null,
    notes: input.notes?.trim() ?? "",
    created_at: now,
  });
  touchAccountActivity(accountId, now);
  return id;
}

const FIELD_MAP: Record<keyof NewProspectInput, string> = {
  name: "name",
  title: "title",
  email: "email",
  phone: "phone",
  linkedin: "linkedin",
  notes: "notes",
};

export function updateProspect(id: string, patch: ProspectPatch): void {
  const row = db
    .prepare("SELECT account_id FROM prospects WHERE id = ?")
    .get(id) as { account_id: string } | undefined;
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const key of Object.keys(patch) as (keyof NewProspectInput)[]) {
    const col = FIELD_MAP[key];
    const raw = patch[key];
    if (raw === undefined) continue;
    const trimmed = typeof raw === "string" ? raw.trim() : raw;
    if (key === "name") {
      if (!trimmed) throw new Error("Name is required");
      sets.push(`name = @name`);
      params.name = trimmed;
    } else if (key === "notes") {
      sets.push(`notes = @notes`);
      params.notes = trimmed ?? "";
    } else {
      sets.push(`${col} = @${col}`);
      params[col] = trimmed ? trimmed : null;
    }
  }
  if (sets.length === 0) return;
  db.prepare(`UPDATE prospects SET ${sets.join(", ")} WHERE id = @id`).run(params);
  if (row) touchAccountActivity(row.account_id);
}

export function deleteProspect(id: string): void {
  const row = db
    .prepare("SELECT account_id FROM prospects WHERE id = ?")
    .get(id) as { account_id: string } | undefined;
  db.prepare("DELETE FROM prospects WHERE id = ?").run(id);
  if (row) recomputeAccountActivity(row.account_id);
}
