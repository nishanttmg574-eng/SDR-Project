import OpenAI from "openai";

export class OpenAiApiKeyMissingError extends Error {
  constructor() {
    super("OPENAI_API_KEY not set");
    this.name = "OpenAiApiKeyMissingError";
  }
}

export function hasOpenAiApiKey(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}

let cached: OpenAI | null = null;

export function getOpenAiClient(): OpenAI {
  if (!hasOpenAiApiKey()) throw new OpenAiApiKeyMissingError();
  if (!cached) cached = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return cached;
}
