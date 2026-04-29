"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STAGES, TIERS, type Stage, type Tier } from "./config";
import {
  clearCallPrep,
  createAccount,
  deleteAccount,
  importAccounts,
  previewImportAccounts,
  updateAccount,
  type ImportPreviewResult,
  type ImportResult,
} from "./accounts";
import { assertDateOnly, assertDateOnlyOnOrAfter, todayIso } from "./dates";
import {
  clearFollowup,
  setFollowup,
  snoozeFollowup,
} from "./followups";
import type { ParsedRow } from "./import";
import {
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
  INTERACTION_DISPOSITIONS,
  type InteractionDispositionInput,
  OUTCOMES,
  type NewInteractionInput,
  type NewProspectInput,
  type ProspectPatch,
} from "./types";
import { recordInteractionWithDisposition } from "./workflow";

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

function cleanImportRows(rows: ParsedRow[]): ParsedRow[] {
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
      customFields:
        row.customFields && typeof row.customFields === "object"
          ? Object.fromEntries(
              Object.entries(row.customFields)
                .filter(([key, value]) => key.trim() && typeof value === "string" && value.trim())
                .map(([key, value]) => [key.trim(), value.trim()])
            )
          : undefined,
    });
  }
  if (clean.length === 0) {
    throw new Error("No rows with a name to import");
  }
  return clean;
}

export async function previewImportAccountsAction(
  rows: ParsedRow[]
): Promise<ImportPreviewResult> {
  return previewImportAccounts(cleanImportRows(rows));
}

export async function importAccountsAction(
  rows: ParsedRow[]
): Promise<ImportResult> {
  const clean = cleanImportRows(rows);
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
    aiProvider: str(formData.get("aiProvider")) as "openai" | "anthropic",
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
  assertDateOnly(input.date, "Interaction date");
  if (input.channel && !CHANNELS.includes(input.channel)) {
    throw new Error(`Invalid channel: ${input.channel}`);
  }
  if (input.outcome && !OUTCOMES.includes(input.outcome)) {
    throw new Error(`Invalid outcome: ${input.outcome}`);
  }
  return input;
}

function validateDisposition(
  disposition?: InteractionDispositionInput
): InteractionDispositionInput | undefined {
  if (!disposition) return undefined;
  if (!INTERACTION_DISPOSITIONS.includes(disposition.type)) {
    throw new Error(`Invalid disposition: ${disposition.type}`);
  }
  return disposition;
}

export async function createInteractionAction(
  accountId: string,
  input: NewInteractionInput,
  disposition?: InteractionDispositionInput
): Promise<void> {
  const clean = validateInteraction(input);
  const cleanDisposition = validateDisposition(disposition);
  recordInteractionWithDisposition(accountId, clean, cleanDisposition);
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
  assertDateOnlyOnOrAfter(patch.date, todayIso(), "Follow-up date");
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

export async function clearCallPrepAction(accountId: string): Promise<void> {
  clearCallPrep(accountId);
  revalidateAccount(accountId);
}
