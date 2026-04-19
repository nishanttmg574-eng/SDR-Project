import { db } from "./db";
import { DEFAULT_MODEL } from "./config";
import type { Settings } from "./types";

interface SettingsRow {
  workspace: string;
  company: string;
  tier1_def: string;
  tiers_def: string;
  model: string;
}

export function getSettings(): Settings {
  const row = db
    .prepare("SELECT workspace, company, tier1_def, tiers_def, model FROM settings WHERE id = 1")
    .get() as SettingsRow;
  return {
    workspace: row.workspace,
    company: row.company,
    tier1Def: row.tier1_def,
    tiersDef: row.tiers_def,
    model: row.model || DEFAULT_MODEL,
  };
}

export function saveSettings(input: Settings): void {
  db.prepare(
    `UPDATE settings
       SET workspace = @workspace,
           company   = @company,
           tier1_def = @tier1Def,
           tiers_def = @tiersDef,
           model     = @model
     WHERE id = 1`
  ).run({
    workspace: input.workspace.trim() || "Account Workspace",
    company: input.company.trim(),
    tier1Def: input.tier1Def.trim(),
    tiersDef: input.tiersDef.trim(),
    model: input.model.trim() || DEFAULT_MODEL,
  });
}

export function isConfigured(s: Settings): boolean {
  return s.company.trim() !== "" || s.tier1Def.trim() !== "";
}
