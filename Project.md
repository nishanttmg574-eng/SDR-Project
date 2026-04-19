# Account Workspace

A personal CRM replacement for an SDR who manages target accounts in a spreadsheet today.
Private, single-user, runs locally on the user's machine.

## Who this is for

One SDR. Their workflow today: a spreadsheet with ~50-500 accounts,
manually-verified tiers (Tier 1-4), columns for funding signals, country presence,
and free-text notes. They have a CRM at work (Salesforce) but it doesn't help
them prioritize or personalize — hence the spreadsheet.

This tool replaces the spreadsheet and adds what the spreadsheet can't do:
structured interaction history, follow-up management, AI-assisted scoring, and
AI-generated call openers.

## Non-negotiable principles

1. **Human judgment over AI judgment.** AI proposes, human decides.
   Tiers have two states (AI-proposed, human-verified). Human override is
   sticky — never overwritten by re-scoring.

2. **Evidence, not verdicts.** When AI scores an account, it must return
   structured evidence (funding details with source URLs, countries found,
   hiring signals) alongside the tier. A tier without evidence is not useful.

3. **Interaction log is core, not an add-on.** Every touch is a structured
   row (date, channel, person, outcome, notes, next step). Not a free-text
   notes blob. Timeline view per account.

4. **Follow-ups have reasons.** The follow-up date carries a `reason` field
   ("they said call after Q1 earnings"). Snooze functionality. Overdue ones
   surface on the dashboard.

5. **No hardcoded industry/company/vertical.** All scoring criteria is
   user-defined in settings. No specific industry jargon baked into source.

6. **Call prep uses the user's own notes, not web scraping.** The prompt
   is built from: user's notes + interaction history + known prospects +
   AI evidence. Better inputs = better outputs.

7. **Cheap to escape.** JSON export at all times. All data in one file or
   one DB that the user owns. Never trapped.

## What to build

- CSV and XLSX import with flexible column detection
- Account list with filters (tier, stage, has-followup, needs-review)
- Account detail view with tabs: Overview, Interactions, Prospects, Call prep, Follow-up
- Settings screen (workspace name, company description, tier definitions, AI model)
- Bulk AI scoring with cancel button, progress bar, batched saves
- Single-account "Research & score" for deep dives
- JSON backup and restore
- Keyboard shortcuts (Cmd+K for search, Esc to close modals)

## What NOT to build (unless asked)

- Kanban view (table + filters is enough for a single user)
- Sprints, sharing, multi-user features
- Real-time sync
- Dashboard vanity metrics (no "meetings booked this week" stat boxes unless tied to actual interaction data)
- Mobile-specific UI

## Data model principles

- **Account**: identifying fields + AI fields + human-override fields + stage + notes + interactions[] + prospects[] + followup + callPrep
- **Interaction**: date, channel, person, outcome (no-answer/connected/replied/meeting/objection/dead), notes, nextStep
- **Prospect**: name, title, email, phone, linkedin, notes
- **Followup**: date, reason, setAt
- **Settings**: workspace name, company description, tier1 definition, lower tier definitions, AI model

## Chosen stack

**Next.js 15 (App Router) + TypeScript + React 19 + Tailwind CSS + better-sqlite3.**
The official `@anthropic-ai/sdk` will be added when AI features land — it is not a skeleton dependency.

Next.js gives us one framework, one dev server, and one build — the App Router lets pages and API routes live side-by-side as files, which is the simplest mental model to explain to a non-engineer ("every URL is a file"). TypeScript earns its keep because the data model has many optional AI/human-override fields; a typed `Account` catches mistakes early and serves as documentation. SQLite via `better-sqlite3` is one local file the user owns (`data/workspace.db`), synchronous and fast enough for 2000 accounts, and supports the structured filters we'll need (tier, stage, overdue follow-ups) far better than a debounced JSON blob — JSON export for backup is trivial on top. Tailwind keeps UI iteration fast and readable without inventing a design system. Every dependency is justified in the README; nothing added "just in case".

## Stack decisions

Claude Code: pick the stack based on these constraints. Document your choice
with 3-5 sentence reasoning in this file under a new heading "Chosen stack"
BEFORE writing any code.

Constraints:
- Single user, runs locally (localhost), never deployed
- Needs to call the Anthropic API with web search tool
- 50-500 accounts typical, 2000 max
- User is an SDR with basic coding knowledge — favor simplicity over cleverness
- Must support CSV and XLSX import on day one

Evaluate:
- **Backend**: Node.js + Express vs Next.js API routes vs something else
- **Frontend**: React (in Next.js) vs vanilla HTML+JS served by Express vs something else
- **Data**: SQLite via `better-sqlite3` vs flat JSON file with debounced writes
- **AI SDK**: `@anthropic-ai/sdk` (official)

Optimize for: simplicity, iteration speed, and "the user could explain this stack to a non-engineer."

## AI behavior rules

- Model IDs live in a config file (`config.ts` or similar) or `.env`. Never hardcoded in call sites.
- API key from `.env` (`ANTHROPIC_API_KEY`). Never committed, never logged.
- Scoring must return structured JSON. If parse fails, mark account as scoring-failed with the raw response stored for debugging.
- Bulk scoring must have a cancel button that works mid-batch.
- Every AI-touched field is marked with `aiProposedAt` timestamp. Human overrides set `humanVerifiedAt`.

## Development discipline

- Git init on day one. Commit after every milestone.
- Every milestone must produce a runnable, testable app.
- Manual smoke test after each feature (run, click, verify) before moving on.
- README stays current with setup instructions.
- No magic. If Claude Code adds a library, it must justify it in 1 sentence.

## Existing reference

The user previously built a v1 of this as a single-file HTML artifact.
It worked but hit limits of the artifact runtime (postMessage rate limits,
fetch restrictions, no localStorage reliability). The v1 HTML file is in
`reference/v1.html` for reference only — do not copy wholesale. The data
model and UI patterns are good references. The architecture needs a real rebuild.
