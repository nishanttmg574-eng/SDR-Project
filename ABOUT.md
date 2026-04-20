# About this tool

Context for why it exists, what's different about it, and what it is not trying to be. If you just want to use it, start with [README.md](README.md) and [QUICKSTART.md](QUICKSTART.md).

## Why this exists

Most SDRs I've talked to run a shadow spreadsheet. They have a company CRM (often Salesforce), and they also have a Google Sheet or an Excel file with their actual target accounts. Columns for self-assigned tiers, funding signals, country presence, free-text notes on past conversations. Columns the CRM doesn't have, or columns the CRM has but makes annoying to edit.

The spreadsheet solves real problems: fast editing, custom columns, personal prioritization. It also has real limits. Interaction history turns into a pile of text in a "notes" column. Follow-ups live in your head or in a reminders app that has no context. There is no AI. Tiers are stale the moment you stop looking at them.

This tool replaces the spreadsheet, keeps what the spreadsheet is good at (your structure, your prioritization), and adds the things the spreadsheet can't do well: structured interactions, follow-ups with reasons, and AI scoring that shows its work.

## What's different about it

Most "AI sales tools" make the AI the protagonist. They auto-score pipelines, auto-sequence emails, and leave the human doing cleanup after the fact. The implicit claim is that AI judgment is better than yours.

This tool inverts that. AI proposes; you decide. Every AI tier is accompanied by evidence (funding detail, source URLs, countries, hiring signals) so you can check the work before you trust it. When you override a tier, the override is sticky, and re-scoring never touches it. You can turn off AI entirely (don't set an API key) and the tool still beats a spreadsheet.

The test I apply to every feature is: does this make the human's judgment faster and better, or does it just hide the judgment behind a confident AI output? If it's the latter, it doesn't ship.

## The seven principles

These are the constraints the tool is built against. The canonical source is [Project.md](Project.md); the version below is in plain language.

**1. Human judgment wins.** The AI suggests a tier. Your override stays, even after re-scoring. Every AI-touched field is timestamped so you can see what came from where.

**2. Evidence, not verdicts.** An AI tier with no supporting detail is a guess in a trench coat. Scoring returns a structured evidence block: funding amount and source URL, countries, hiring signals, and a confidence level. You can follow the links.

**3. Interactions are structured rows.** Date, channel, person, outcome, notes, next step. Filterable, queryable, not a wall of pasted text. "Everyone I connected with this week who hasn't booked yet" is one filter combination, not a grep.

**4. Follow-ups carry a reason.** Not just "follow up on Friday" but "follow up Friday because they said to call after Q1 earnings." A date without a reason goes stale; a reason without a date never happens. Snooze supported. Overdue, today, and upcoming buckets show on the dashboard.

**5. No industry or vertical hardcoded.** Your Tier 1 definition, your company description, and your tier distinctions live in Settings, and the scoring prompt is built from them. Nothing in the source code assumes a particular industry.

**6. Call prep uses your notes, not the open web.** The prompt is built from your notes, your last three interactions, your known prospects, and the AI evidence already cached from scoring. Garbage in, garbage out, but it's your garbage. Call prep does not run a fresh web search.

**7. Cheap to escape.** JSON export at any time. All your data is in one SQLite file you own (`data/workspace.db`). You will never be trapped in this tool.

## What this isn't trying to be

- **Not a CRM.** No pipelines, no deal stages beyond a light account-stage field, no forecasting, no manager reporting.
- **Not a sequencer.** No email sending, no LinkedIn automation, no cadences.
- **Not a data provider.** It won't find you new accounts or enrich contacts. You bring the accounts in.
- **Not finished.** It is beta software. You will hit rough edges. That's what the beta is for.

## How the AI works under the hood

AI is used in exactly two places.

**Account scoring.** When you click "Research & score" on an account (or score in bulk), the app sends the following to Claude: account name, website, industry, location, headcount, your company description, and your tier definitions. Claude is allowed to use web search, capped at two searches per account. The response is parsed into a tier, a confidence level (high, medium, low), a reasoning summary, any gaps it noticed, and a structured evidence block covering funding, countries, and hiring. Everything is stored locally so you can see it later.

**Call prep.** When you click "Call prep" on an account, the app sends: the account's name and industry, your notes for that account, the last three interactions, the known prospects, and the cached AI evidence from scoring. No web search. The output is five short sections: opener, qualifying questions, value bridge, CTA, and a likely objection with a handler.

**Without an API key**, these two features return an error message. Everything else still works: import, account list with filters, interactions, prospects, follow-ups, dashboard, JSON backup, and restore. Human tier overrides work without AI.

## Privacy

- **Data stays local.** All accounts, interactions, prospects, and settings live in `data/workspace.db` on your machine. No sync. No telemetry. No analytics.
- **The API key stays local.** It lives in `.env`, is loaded at server start, is never logged, and is never written to the database. It leaves your machine only as the authorization header on requests to `api.anthropic.com` during scoring or call prep.
- **The app does not call any other server.** No third-party trackers, no update pings, nothing.

## Roadmap, if beta feedback justifies it

Things I'd build next, in rough priority order, if testers tell me they'd move the needle:

- Fuzzy dedup on import (so "Acme Inc" and "Acme Incorporated" merge).
- Keyboard shortcuts (Cmd+K for search, Esc to close modals).
- Bulk scoring that resumes cleanly across a dev-server restart.
- Lighter-weight prospect entry (paste a LinkedIn URL, get a pre-filled form).
- Screenshots and short video clips in the docs.

If the beta tells me these don't matter, I won't build them.

## What's NOT on the roadmap

Saying this explicitly so nobody plans around it:

- No team mode, sharing, or multi-user support.
- No mobile app and no mobile-specific UI.
- No Salesforce, HubSpot, Gmail, or Outlook integrations.
- No email sequencing or cadences.
- No kanban view, sprints, or dashboard vanity metrics.

If that's what you need, this is the wrong tool. That's fine; it was never trying to be.

## Thanks

To the testers taking a chance on a rough first version: thank you. Your feedback is what decides whether any of the roadmap above actually ships.

_[testers to be credited after beta]_
