import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { APIError, RateLimitError } from "openai";
import {
  AI_PROVIDER_ENV_VARS,
  AI_PROVIDER_LABELS,
  type AiProviderId,
} from "./config";
import { getClient as getAnthropicClient, hasAnthropicApiKey } from "./anthropic";
import { getOpenAiClient, hasOpenAiApiKey } from "./openai";
import {
  AiApiKeyMissingError,
  AiProviderRequestError,
  AiSchemaValidationError,
} from "./ai-errors";
import {
  callPrepResponseSchema,
  scoringResponseSchema,
  type CallPrepResponse,
  type ScoringResponse,
} from "./ai-schemas";
import type { Settings } from "./types";

export interface ProviderJsonResult<T> {
  value: T;
  rawResponse: string | null;
  providerRequestId: string | null;
  usage: Record<string, unknown> | null;
}

interface ProviderJsonArgs {
  settings: Settings;
  system: string;
  user: string;
  signal?: AbortSignal;
}

interface AiProvider {
  id: AiProviderId;
  label: string;
  envVar: string;
  hasApiKey: () => boolean;
  score: (args: ProviderJsonArgs) => Promise<ProviderJsonResult<ScoringResponse>>;
  callPrep: (args: ProviderJsonArgs) => Promise<ProviderJsonResult<CallPrepResponse>>;
}

export interface AiReadiness {
  provider: AiProviderId;
  label: string;
  envVar: string;
  configured: boolean;
  setupHint: string;
}

function jsonErrorMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function stripFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "");
    t = t.replace(/```\s*$/, "");
  }
  return t.trim();
}

function pickLastText(content: unknown[]): string | null {
  for (let i = content.length - 1; i >= 0; i--) {
    const block = content[i] as { type?: string; text?: string };
    if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
      return block.text;
    }
  }
  return null;
}

function normalizeUsage(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function retryAfterMsFromError(error: unknown): number | null {
  const headers = (error as { headers?: unknown })?.headers;
  const get = (name: string): string | null => {
    if (!headers) return null;
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name);
    }
    const record = headers as Record<string, string | undefined>;
    return record[name] ?? record[name.toLowerCase()] ?? null;
  };
  const retryAfter = get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  const reset = get("x-ratelimit-reset-requests") ?? get("x-ratelimit-reset-tokens");
  if (reset) {
    const date = Date.parse(reset);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  return null;
}

function providerError(error: unknown): AiProviderRequestError {
  if (error instanceof AiApiKeyMissingError) {
    return new AiProviderRequestError(error.message, null, false, null);
  }
  if (error instanceof APIError || error instanceof RateLimitError) {
    const status = error.status ?? 0;
    const transient =
      error instanceof RateLimitError || status === 408 || status === 409 || status >= 500;
    return new AiProviderRequestError(
      error.message,
      null,
      transient,
      retryAfterMsFromError(error)
    );
  }
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const aborted = name === "AbortError" || /abort|cancel/i.test(message);
  return new AiProviderRequestError(message, null, aborted, null);
}

async function runAnthropicJson<T>(
  args: ProviderJsonArgs & {
    schema: z.ZodType<T>;
    maxTokens: number;
    webSearch: boolean;
  }
): Promise<ProviderJsonResult<T>> {
  if (!hasAnthropicApiKey()) {
    throw new AiApiKeyMissingError("anthropic", AI_PROVIDER_ENV_VARS.anthropic);
  }

  let rawText: string | null = null;
  try {
    const response = await getAnthropicClient().messages.create(
      {
        model: args.settings.model,
        max_tokens: args.maxTokens,
        system: args.system,
        tools: args.webSearch
          ? [
              {
                type: "web_search_20250305",
                name: "web_search",
                max_uses: 2,
              } as never,
            ]
          : undefined,
        messages: [{ role: "user", content: args.user }],
      },
      { signal: args.signal }
    );

    const content = Array.isArray(response.content) ? response.content : [];
    rawText = pickLastText(content as unknown[]);
    if (!rawText) {
      throw new AiSchemaValidationError(
        "Model returned no text block",
        JSON.stringify(content).slice(0, 4000)
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(rawText));
    } catch {
      throw new AiSchemaValidationError("JSON parse failed", rawText);
    }

    const result = args.schema.safeParse(parsed);
    if (!result.success) {
      throw new AiSchemaValidationError(jsonErrorMessage(result.error), rawText);
    }

    return {
      value: result.data,
      rawResponse: rawText,
      providerRequestId: typeof response.id === "string" ? response.id : null,
      usage: normalizeUsage(response.usage),
    };
  } catch (error) {
    if (error instanceof AiSchemaValidationError) throw error;
    throw providerError(error);
  }
}

async function runOpenAiJson<T>(
  args: ProviderJsonArgs & {
    schema: z.ZodType<T>;
    schemaName: string;
    maxTokens: number;
    webSearch: boolean;
  }
): Promise<ProviderJsonResult<T>> {
  if (!hasOpenAiApiKey()) {
    throw new AiApiKeyMissingError("openai", AI_PROVIDER_ENV_VARS.openai);
  }

  try {
    const response = await getOpenAiClient().responses.parse({
      model: args.settings.model,
      instructions: args.system,
      input: args.user,
      max_output_tokens: args.maxTokens,
      max_tool_calls: args.webSearch ? 2 : undefined,
      include: args.webSearch ? ["web_search_call.action.sources"] : undefined,
      tools: args.webSearch
        ? [{ type: "web_search", search_context_size: "medium" }]
        : undefined,
      text: {
        format: zodTextFormat(args.schema, args.schemaName),
      },
      store: false,
    }, { signal: args.signal });

    if (response.error) {
      throw new AiProviderRequestError(response.error.message, response.output_text);
    }
    if (!response.output_parsed) {
      throw new AiSchemaValidationError(
        "Structured output parse returned no parsed object",
        response.output_text
      );
    }

    return {
      value: response.output_parsed,
      rawResponse: response.output_text,
      providerRequestId: response.id ?? null,
      usage: normalizeUsage(response.usage),
    };
  } catch (error) {
    if (error instanceof AiSchemaValidationError || error instanceof AiProviderRequestError) {
      throw error;
    }
    throw providerError(error);
  }
}

export const providerRegistry: Record<AiProviderId, AiProvider> = {
  openai: {
    id: "openai",
    label: AI_PROVIDER_LABELS.openai,
    envVar: AI_PROVIDER_ENV_VARS.openai,
    hasApiKey: hasOpenAiApiKey,
    score: (args) =>
      runOpenAiJson({
        ...args,
        schema: scoringResponseSchema,
        schemaName: "account_score",
        maxTokens: 2400,
        webSearch: true,
      }),
    callPrep: (args) =>
      runOpenAiJson({
        ...args,
        schema: callPrepResponseSchema,
        schemaName: "call_prep",
        maxTokens: 1600,
        webSearch: false,
      }),
  },
  anthropic: {
    id: "anthropic",
    label: AI_PROVIDER_LABELS.anthropic,
    envVar: AI_PROVIDER_ENV_VARS.anthropic,
    hasApiKey: hasAnthropicApiKey,
    score: (args) =>
      runAnthropicJson({
        ...args,
        schema: scoringResponseSchema,
        maxTokens: 2400,
        webSearch: true,
      }),
    callPrep: (args) =>
      runAnthropicJson({
        ...args,
        schema: callPrepResponseSchema,
        maxTokens: 1600,
        webSearch: false,
      }),
  },
};

export function getProvider(provider: AiProviderId): AiProvider {
  return providerRegistry[provider];
}

export function hasSelectedProviderApiKey(settings: Settings): boolean {
  return getProvider(settings.aiProvider).hasApiKey();
}

export function getAiReadiness(settings: Settings): AiReadiness {
  const provider = getProvider(settings.aiProvider);
  return {
    provider: provider.id,
    label: provider.label,
    envVar: provider.envVar,
    configured: provider.hasApiKey(),
    setupHint: provider.hasApiKey()
      ? `Loaded from ${provider.envVar} in .env.`
      : `Not found in .env. Add ${provider.envVar} to your .env file and restart.`,
  };
}
