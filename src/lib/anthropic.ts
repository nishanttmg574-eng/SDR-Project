import Anthropic from "@anthropic-ai/sdk";

export class ApiKeyMissingError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY not set");
    this.name = "ApiKeyMissingError";
  }
}

export function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

let cached: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!hasApiKey()) throw new ApiKeyMissingError();
  if (!cached) cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return cached;
}
