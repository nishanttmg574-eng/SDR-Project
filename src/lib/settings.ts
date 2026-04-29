import { db } from "./db";
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_AI_PROVIDER,
  isAiProviderId,
  modelLooksOpenAi,
  normalizeProviderModel,
} from "./config";
import type { Settings } from "./types";

interface SettingsRow {
  workspace: string;
  company: string;
  tier1_def: string;
  tiers_def: string;
  ai_provider: string;
  model: string;
}

export function getSettings(): Settings {
  const row = db
    .prepare(
      "SELECT workspace, company, tier1_def, tiers_def, ai_provider, model FROM settings WHERE id = 1"
    )
    .get() as SettingsRow;
  const fallbackProvider = row.model
    ? modelLooksOpenAi(row.model)
      ? "openai"
      : "anthropic"
    : DEFAULT_AI_PROVIDER;
  const normalized = normalizeProviderModel({
    provider: row.ai_provider,
    model: row.model,
    fallbackProvider,
  });
  return {
    workspace: row.workspace,
    company: row.company,
    tier1Def: row.tier1_def,
    tiersDef: row.tiers_def,
    aiProvider: normalized.provider,
    model: normalized.model,
  };
}

export function saveSettings(input: Settings): void {
  const normalized = normalizeProviderModel({
    provider: isAiProviderId(input.aiProvider)
      ? input.aiProvider
      : DEFAULT_AI_PROVIDER,
    model: input.model,
    fallbackProvider: DEFAULT_AI_PROVIDER,
  });
  db.prepare(
    `UPDATE settings
       SET workspace = @workspace,
           company   = @company,
           tier1_def = @tier1Def,
           tiers_def = @tiersDef,
           ai_provider = @aiProvider,
           model     = @model
     WHERE id = 1`
  ).run({
    workspace: input.workspace.trim() || "Account Workspace",
    company: input.company.trim(),
    tier1Def: input.tier1Def.trim(),
    tiersDef: input.tiersDef.trim(),
    aiProvider: normalized.provider,
    model: normalized.model || DEFAULT_ANTHROPIC_MODEL,
  });
}

export function isConfigured(s: Settings): boolean {
  return s.company.trim() !== "" || s.tier1Def.trim() !== "";
}
