import type { Account, Interaction, Prospect, Settings } from "./types";
import { getClient } from "./anthropic";

export type CallPrepOutcome =
  | { ok: true; text: string }
  | { ok: false; error: string };

const TIMEOUT_MS = 90_000;

function buildSystem(settings: Settings): string {
  const company = settings.company.trim() || "(company not configured)";
  const tier1 = settings.tier1Def.trim() || "(tier 1 not configured)";
  return `You are helping a sales development rep prepare for a call with a target account.

Our company:
${company}

Our tier-1 ideal customer profile:
${tier1}

You will receive the rep's own notes, interaction history, and prospects for this specific account. Use ONLY that information — do not invent facts, do not speculate about funding or people that were not mentioned.

Produce exactly 5 sections, plain text, no markdown fences, no preamble. Use these headers verbatim, each on its own line followed by the content:

CALL OPENER
2-3 sentences designed to be read aloud in 15-20 seconds. Reference something specific from the notes or last interaction if possible.

QUALIFYING QUESTIONS
Three numbered questions (1., 2., 3.) tailored to what is NOT yet known from the notes.

VALUE BRIDGE
One sentence connecting our company to this account's situation.

CTA
The one concrete ask for this call (book a demo, intro meeting, next-step date, etc.).

LIKELY OBJECTION + HANDLER
One objection this account is likely to raise, followed by a 1-2 sentence handler.

If a section cannot be grounded in the inputs (empty notes and no interactions), write a reasonable generic version and append " (generic — thin notes)" to the end of that section.`;
}

function formatInteraction(i: Interaction): string {
  const parts: string[] = [`[${i.date}]`];
  if (i.channel) parts.push(i.channel);
  if (i.outcome) parts.push(`• ${i.outcome}`);
  if (i.person) parts.push(`with ${i.person}`);
  let line = parts.join(" ");
  if (i.notes.trim()) line += ` — ${i.notes.trim()}`;
  if (i.nextStep?.trim()) line += ` — next: ${i.nextStep.trim()}`;
  return line;
}

function formatProspect(p: Prospect): string {
  const parts: string[] = [p.name];
  if (p.title) parts.push(p.title);
  if (p.email) parts.push(p.email);
  return parts.join(" • ");
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
    for (const i of interactions) lines.push(`- ${formatInteraction(i)}`);
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
  }

  return lines.join("\n");
}

function stripFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:\w+)?\s*/i, "");
    t = t.replace(/```\s*$/, "");
  }
  return t.trim();
}

function collectText(content: unknown[]): string {
  const pieces: string[] = [];
  for (const block of content) {
    const b = block as { type?: string; text?: string };
    if (b?.type === "text" && typeof b.text === "string") pieces.push(b.text);
  }
  return pieces.join("\n").trim();
}

export async function generateCallPrep(
  account: Account,
  settings: Settings,
  interactions: Interaction[],
  prospects: Prospect[],
  opts: { signal?: AbortSignal } = {}
): Promise<CallPrepOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const client = getClient();
    const response = await client.messages.create(
      {
        model: settings.model,
        max_tokens: 1500,
        system: buildSystem(settings),
        messages: [
          { role: "user", content: buildUser(account, interactions, prospects) },
        ],
      },
      { signal: controller.signal }
    );

    const content = Array.isArray(response.content) ? response.content : [];
    const text = stripFences(collectText(content as unknown[]));
    if (!text) {
      return { ok: false, error: "Model returned no text" };
    }
    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (controller.signal.aborted) {
      return { ok: false, error: `Timeout (${TIMEOUT_MS}ms budget)` };
    }
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
