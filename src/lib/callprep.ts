import {
  CALL_PREP_PROMPT_VERSION,
  CALL_PREP_TOOL_CONFIG,
  buildAiMetadata,
  callPrepInputHash,
} from "./ai-metadata";
import {
  AiProviderRequestError,
  AiSchemaValidationError,
} from "./ai-errors";
import { formatCallPrep } from "./ai-schemas";
import { getProvider } from "./ai-providers";
import type { Account, AiMetadata, Interaction, Prospect, Settings } from "./types";

export type CallPrepOutcome =
  | { ok: true; text: string; metadata: AiMetadata }
  | {
      ok: false;
      error: string;
      errorType: "provider" | "schema";
      transient?: boolean;
      retryAfterMs?: number | null;
    };

const TIMEOUT_MS = 90_000;

function buildSystem(settings: Settings): string {
  const company = settings.company.trim() || "(company not configured)";
  const tier1 = settings.tier1Def.trim() || "(tier 1 not configured)";
  return `You are helping a sales development rep prepare for a call with a target account.

Our company:
${company}

Our tier-1 ideal customer profile:
${tier1}

Use only the rep's notes, interaction history, known prospects, and existing scoring evidence. Do not invent facts, people, funding, or hiring details that were not provided.

Return a structured JSON object with:
- callOpener: 2-3 sentences designed to be read aloud in 15-20 seconds.
- qualifyingQuestions: exactly 3 questions tailored to what is not yet known.
- valueBridge: one sentence connecting our company to this account's situation.
- cta: one concrete ask for this call.
- likelyObjectionAndHandler: one likely objection and a short handler.
- thinNotes: true when the inputs are too thin and the output is mostly generic.`;
}

function formatInteraction(i: Interaction): string {
  const parts: string[] = [`[${i.date}]`];
  if (i.channel) parts.push(i.channel);
  if (i.outcome) parts.push(`- ${i.outcome}`);
  if (i.person) parts.push(`with ${i.person}`);
  let line = parts.join(" ");
  if (i.notes.trim()) line += ` - ${i.notes.trim()}`;
  if (i.nextStep?.trim()) line += ` - next: ${i.nextStep.trim()}`;
  return line;
}

function formatProspect(p: Prospect): string {
  const parts: string[] = [p.name];
  if (p.title) parts.push(p.title);
  if (p.email) parts.push(p.email);
  if (p.phone) parts.push(p.phone);
  if (p.linkedin) parts.push(p.linkedin);
  return parts.join(" - ");
}

function buildUser(
  account: Account,
  interactions: Interaction[],
  prospects: Prospect[]
): string {
  const lines: string[] = [];
  lines.push(`Account: ${account.name}`);
  if (account.industry) lines.push(`Industry: ${account.industry}`);
  if (account.location) lines.push(`Location: ${account.location}`);
  const tier = account.humanTier ?? account.aiTier;
  if (tier) lines.push(`Tier: ${tier}`);

  lines.push("");
  lines.push("Notes:");
  lines.push(account.notes.trim() || "(none)");

  lines.push("");
  lines.push("Last 3 interactions (most recent first):");
  if (interactions.length === 0) {
    lines.push("(none)");
  } else {
    for (const i of interactions.slice(0, 3)) lines.push(`- ${formatInteraction(i)}`);
  }

  lines.push("");
  lines.push("Known prospects:");
  if (prospects.length === 0) {
    lines.push("(none)");
  } else {
    for (const p of prospects) lines.push(`- ${formatProspect(p)}`);
  }

  const ev = account.aiEvidence;
  if (ev) {
    lines.push("");
    lines.push("AI research evidence:");
    if (ev.funding?.summary) lines.push(`- Funding: ${ev.funding.summary}`);
    if (ev.countries.length > 0) lines.push(`- Countries: ${ev.countries.join(", ")}`);
    if (ev.hiring?.summary) lines.push(`- Hiring: ${ev.hiring.summary}`);
    if (ev.entity_match) lines.push(`- Entity match: ${ev.entity_match}`);
    if (ev.entityMatchFlag) lines.push(`- Warning: ${ev.entityMatchFlag}`);
  }

  return lines.join("\n");
}

function withTimeout(parentSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

function failureFromError(
  error: unknown,
  controllerSignal: AbortSignal
): Exclude<CallPrepOutcome, { ok: true }> {
  if (error instanceof AiSchemaValidationError) {
    return {
      ok: false,
      error: error.message,
      errorType: "schema",
    };
  }
  if (error instanceof AiProviderRequestError) {
    return {
      ok: false,
      error: error.message,
      errorType: "provider",
      transient: error.transient,
      retryAfterMs: error.retryAfterMs,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    error: controllerSignal.aborted
      ? `Timeout or cancelled (${TIMEOUT_MS}ms budget)`
      : message,
    errorType: "provider",
    transient: controllerSignal.aborted,
  };
}

export async function generateCallPrep(
  account: Account,
  settings: Settings,
  interactions: Interaction[],
  prospects: Prospect[],
  opts: { signal?: AbortSignal } = {}
): Promise<CallPrepOutcome> {
  const timeout = withTimeout(opts.signal);
  const provider = getProvider(settings.aiProvider);
  const inputHash = callPrepInputHash(account, interactions, prospects);

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await provider.callPrep({
          settings,
          system: buildSystem(settings),
          user: buildUser(account, interactions, prospects),
          signal: timeout.signal,
        });
        return {
          ok: true,
          text: formatCallPrep(result.value),
          metadata: buildAiMetadata({
            settings,
            promptVersion: CALL_PREP_PROMPT_VERSION,
            inputHash,
            toolConfig: CALL_PREP_TOOL_CONFIG,
            providerRequestId: result.providerRequestId,
            usage: result.usage,
          }),
        };
      } catch (error) {
        if (error instanceof AiSchemaValidationError && attempt === 0) {
          continue;
        }
        throw error;
      }
    }
    return {
      ok: false,
      error: "Schema validation failed after retry",
      errorType: "schema",
    };
  } catch (error) {
    return failureFromError(error, timeout.signal);
  } finally {
    timeout.cleanup();
  }
}
