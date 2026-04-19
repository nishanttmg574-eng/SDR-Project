"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STAGES, TIERS, type Stage, type Tier } from "./config";
import {
  createAccount,
  deleteAccount,
  updateAccount,
} from "./accounts";
import { saveSettings } from "./settings";

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
