import type { AiErrorType } from "./types";

export class AiApiKeyMissingError extends Error {
  constructor(
    public readonly provider: "openai" | "anthropic",
    public readonly envVar: string
  ) {
    super(`${envVar} not set`);
    this.name = "AiApiKeyMissingError";
  }
}

export class AiSchemaValidationError extends Error {
  readonly errorType: AiErrorType = "schema";

  constructor(
    message: string,
    public readonly rawResponse: string | null
  ) {
    super(message);
    this.name = "AiSchemaValidationError";
  }
}

export class AiProviderRequestError extends Error {
  readonly errorType: AiErrorType = "provider";

  constructor(
    message: string,
    public readonly rawResponse: string | null = null,
    public readonly transient = false,
    public readonly retryAfterMs: number | null = null
  ) {
    super(message);
    this.name = "AiProviderRequestError";
  }
}
