# Account Workspace

A personal CRM replacement for an SDR who manages target accounts in a spreadsheet today. Private, single-user, runs locally on your machine. Replaces the spreadsheet with structured interaction history, follow-up management, AI-assisted scoring, and AI-generated call openers.

This repo is currently at the **skeleton** stage — the app runs and the data layer is wired up, but no business features are built yet.

## Requirements

- Node.js 20 or newer (`node --version`)
- macOS / Linux (Windows should work but untested)

## Install

```bash
cp .env.example .env            # (optional for the skeleton; required once AI features land)
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

## Stack

Next.js (App Router) + TypeScript + React + Tailwind + `better-sqlite3`. See `Project.md` → **Chosen stack** for reasoning.

## Project structure

```
data/               # your SQLite DB lives here (gitignored)
reference/          # v1.html — the single-file prototype, kept for reference only
src/
  app/              # Next.js App Router pages
  lib/db.ts         # SQLite connection + schema migrations
Project.md          # product principles and constraints — read this before building
```

## Status

Skeleton only. No import, no account list, no AI — those land in later milestones. See `Project.md` for the full roadmap.
