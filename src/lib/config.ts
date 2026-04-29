export const AI_PROVIDERS = ["openai", "anthropic"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const DEFAULT_AI_PROVIDER: AiProviderId = "openai";
export const DEFAULT_OPENAI_MODEL = "gpt-5.5";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

// Back-compat for older imports. New code should use providerDefaultModel().
export const DEFAULT_MODEL = DEFAULT_ANTHROPIC_MODEL;

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

export const AI_PROVIDER_ENV_VARS: Record<AiProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

export const AI_PROVIDER_MODELS: Record<AiProviderId, string[]> = {
  openai: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"],
  anthropic: ["claude-sonnet-4-6", "claude-opus-4-1", "claude-haiku-4-5"],
};

export function providerDefaultModel(provider: AiProviderId): string {
  return provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
}

export function isAiProviderId(value: unknown): value is AiProviderId {
  return value === "openai" || value === "anthropic";
}

export function modelLooksOpenAi(model: string | null | undefined): boolean {
  const value = model?.trim().toLowerCase() ?? "";
  return (
    value.startsWith("gpt-") ||
    value.startsWith("o1") ||
    value.startsWith("o3") ||
    value.startsWith("o4") ||
    value.startsWith("chatgpt-")
  );
}

export function normalizeProviderModel(input: {
  provider?: string | null;
  model?: string | null;
  fallbackProvider?: AiProviderId;
}): { provider: AiProviderId; model: string } {
  const provider = isAiProviderId(input.provider)
    ? input.provider
    : input.fallbackProvider ?? DEFAULT_AI_PROVIDER;
  const model = input.model?.trim() || providerDefaultModel(provider);
  return { provider, model };
}

export const STAGES = ["new", "working", "followup", "meeting", "dead"] as const;
export type Stage = (typeof STAGES)[number];

export const TIERS = ["1", "2", "3", "4"] as const;
export type Tier = (typeof TIERS)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  working: "Working",
  followup: "Follow-up",
  meeting: "Meeting",
  dead: "Dead",
};
