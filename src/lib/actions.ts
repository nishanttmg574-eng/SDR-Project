"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STAGES, TIERS, type Stage, type Tier } from "./config";
import {
  createAccount,
  deleteAccount,
  getAccount,
  importAccounts,
  updateAccount,
} from "./accounts";
import { db } from "./db";
import {
  clearFollowup,
  setFollowup,
  snoozeFollowup,
} from "./followups";
import type { ParsedRow } from "./import";
import {
  createInteraction,
  deleteInteraction,
} from "./interactions";
import {
  createProspect,
  deleteProspect,
  updateProspect,
} from "./prospects";
import { saveSettings } from "./settings";
import {
  CHANNELS,
  OUTCOMES,
  type NewInteractionInput,
  type NewProspectInput,
  type ProspectPatch,
} from "./types";

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export async function createAccountAction(formData: FormData): Promise<void> {
  const name = str(formData.get("name")).trim();
  if (!name) {
    throw new Error("Name is required");
  }
  createAccount({
    name,
    website: str(formData.get("website")),
    industry: str(formData.get("industry")),
    location: str(formData.get("location")),
    headcount: str(formData.get("headcount")),
  });
  revalidatePath("/");
  redirect("/");
}

export async function updateAccountAction(
  id: string,
  patch: { humanTier?: Tier | null; stage?: Stage; notes?: string }
): Promise<void> {
  if (patch.stage !== undefined && !STAGES.includes(patch.stage)) {
    throw new Error(`Invalid stage: ${patch.stage}`);
  }
  if (
    patch.humanTier !== undefined &&
    patch.humanTier !== null &&
    !TIERS.includes(patch.humanTier)
  ) {
    throw new Error(`Invalid tier: ${patch.humanTier}`);
  }
  updateAccount(id, patch);
  revalidatePath("/");
  revalidatePath(`/accounts/${id}`);
}

export async function deleteAccountAction(id: string): Promise<void> {
  deleteAccount(id);
  revalidatePath("/");
  redirect("/");
}

export async function importAccountsAction(
  rows: ParsedRow[]
): Promise<{ added: number; updated: number }> {
  if (!Array.isArray(rows)) {
    throw new Error("Invalid payload: expected an array of rows");
  }
  const clean: ParsedRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    clean.push({
      name,
      website: typeof row.website === "string" ? row.website : undefined,
      industry: typeof row.industry === "string" ? row.industry : undefined,
      location: typeof row.location === "string" ? row.location : undefined,
      headcount: typeof row.headcount === "string" ? row.headcount : undefined,
    });
  }
  if (clean.length === 0) {
    throw new Error("No rows with a name to import");
  }
  const result = importAccounts(clean);
  revalidatePath("/");
  return result;
}

export async function saveSettingsAction(formData: FormData): Promise<void> {
  saveSettings({
    workspace: str(formData.get("workspace")),
    company: str(formData.get("company")),
    tier1Def: str(formData.get("tier1Def")),
    tiersDef: str(formData.get("tiersDef")),
    model: str(formData.get("model")),
  });
  revalidatePath("/", "layout");
  redirect("/");
}

function revalidateAccount(id: string): void {
  revalidatePath("/");
  revalidatePath(`/accounts/${id}`);
}

function validateInteraction(input: NewInteractionInput): NewInteractionInput {
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Date is required (YYYY-MM-DD)");
  }
  if (input.channel && !CHANNELS.includes(input.channel)) {
    throw new Error(`Invalid channel: ${input.channel}`);
  }
  if (input.outcome && !OUTCOMES.includes(input.outcome)) {
    throw new Error(`Invalid outcome: ${input.outcome}`);
  }
  return input;
}

export async function createInteractionAction(
  accountId: string,
  input: NewInteractionInput
): Promise<void> {
  const clean = validateInteraction(input);

  const run = db.transaction(() => {
    const account = getAccount(accountId);
    if (!account) throw new Error("Account not found");

    let nextStage: Stage | undefined;
    if (clean.outcome === "meeting") nextStage = "meeting";
    else if (clean.outcome === "dead") nextStage = "dead";
    else if (account.stage === "new" && clean.outcome) nextStage = "working";

    if (nextStage && nextStage !== account.stage) {
      updateAccount(accountId, { stage: nextStage });
    }
    createInteraction(accountId, clean);
  });
  run();
  revalidateAccount(accountId);
}

export async function deleteInteractionAction(
  accountId: string,
  interactionId: string
): Promise<void> {
  deleteInteraction(interactionId);
  revalidateAccount(accountId);
}

export async function createProspectAction(
  accountId: string,
  input: NewProspectInput
): Promise<void> {
  createProspect(accountId, input);
  revalidateAccount(accountId);
}

export async function updateProspectAction(
  accountId: string,
  prospectId: string,
  patch: ProspectPatch
): Promise<void> {
  updateProspect(prospectId, patch);
  revalidateAccount(accountId);
}

export async function deleteProspectAction(
  accountId: string,
  prospectId: string
): Promise<void> {
  deleteProspect(prospectId);
  revalidateAccount(accountId);
}

export async function setFollowupAction(
  accountId: string,
  patch: { date: string; reason: string }
): Promise<void> {
  if (!patch.date || !/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) {
    throw new Error("Date is required (YYYY-MM-DD)");
  }
  setFollowup(accountId, patch);
  revalidateAccount(accountId);
}

export async function clearFollowupAction(accountId: string): Promise<void> {
  clearFollowup(accountId);
  revalidateAccount(accountId);
}

export async function snoozeFollowupAction(
  accountId: string,
  days: number
): Promise<void> {
  snoozeFollowup(accountId, days);
  revalidateAccount(accountId);
}
