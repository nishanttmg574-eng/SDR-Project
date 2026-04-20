# Account Workspace

A personal CRM replacement for an SDR who manages target accounts in a spreadsheet today. Private, single-user, runs locally on your machine. Replaces the spreadsheet with structured interaction history, follow-up management, AI-assisted scoring, and AI-generated call openers.

The app is now fully functional: CSV/XLSX import, interactions, prospects, follow-ups, JSON backup/restore, and AI-assisted scoring.

## Requirements

- Node.js 20 or newer (`node --version`)
- macOS / Linux (Windows should work but untested)

## Install

```bash
cp .env.example .env            # then fill in ANTHROPIC_API_KEY to enable AI scoring
npm install
```

The `npm install` step compiles `better-sqlite3` for your machine. If it fails, make sure Xcode Command Line Tools are installed (`xcode-select --install`).

## Run

```bash
npm run dev
```

Open http://localhost:3000. You should see an **Account Workspace** heading and a link to `/settings` that proves routing works.

Other scripts:

| Command             | What it does                               |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Start the dev server at http://localhost:3000 |
| `npm run build`     | Production build                           |
| `npm run start`     | Run the production build                   |
| `npm run typecheck` | TypeScript check, no emit                  |
| `npm run lint`      | ESLint (Next.js defaults)                  |

## Where your data lives

All your data is stored **locally** in one SQLite file:

```
./data/workspace.db
```

That file is created the first time the app opens a database connection. It is **not** committed to git (see `.gitignore`). Nothing ever leaves your machine unless you explicitly export it or call the Anthropic API.

You can open the DB with any SQLite tool:

```bash
sqlite3 data/workspace.db ".tables"
# accounts  interactions  prospects  settings
```

### Back up your data

The simplest backup is to copy the file:

```bash
cp data/workspace.db "data/workspace-$(date +%F).db"
```

Once the JSON export feature lands you'll also be able to dump everything to a human-readable `.json` file from inside the app.

## AI scoring

The "Research & score" button on each account page and "Score with AI" on the accounts list call the Anthropic API (Sonnet with web search, capped at 2 searches per account) and return a structured tier + evidence + confidence. The human override is sticky — re-scoring never overwrites a tier you set manually.

- Requires `ANTHROPIC_API_KEY` in `.env` (loaded from there, never stored in the DB).
- Model is configured in Settings (defaults to the value in `src/lib/config.ts`).
- `@anthropic-ai/sdk` is the official Anthropic SDK — used server-side only.

## Stack

Next.js (App Router) + TypeScript + React + Tailwind + `better-sqlite3` + `@anthropic-ai/sdk`. See `Project.md` → **Chosen stack** for reasoning.

## Project structure

```
data/               # your SQLite DB lives here (gitignored)
src/
  app/              # Next.js App Router pages
  lib/db.ts         # SQLite connection + schema migrations
Project.md          # product principles and constraints — read this before building
```

## Status

Sessions 1–5 done: scaffold, accounts, CSV/XLSX import, interactions / prospects / follow-ups / dashboard, AI scoring with evidence. Next: call prep.
