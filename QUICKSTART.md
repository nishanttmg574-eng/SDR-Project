# Quickstart

This guide assumes you've never used a terminal, never cloned a repo, and would rather not read a wall of jargon. It should take you about 20 minutes to get set up, and another 40 minutes to work through the first-hour walkthrough below.

If you just want the overview of what the tool is, read [README.md](README.md) first.

## Prerequisites

Install these before anything else. Each one is a regular installer, like any other app.

**Node.js, version 20 or newer.** Download from [nodejs.org](https://nodejs.org). Pick the "LTS" version, run the installer, accept the defaults. To confirm it worked, open Terminal (see below) and type:

```
node --version
```

You should see something like `v20.x.x` or higher.

**Git.** Download from [git-scm.com](https://git-scm.com). On Windows the installer also gives you a program called "Git Bash" that you'll use instead of Terminal. Confirm with:

```
git --version
```

**An Anthropic API key.** Go to [console.anthropic.com](https://console.anthropic.com), create an account, and add a small amount of credit ($5 is plenty for a beta). Generate a key. It will start with `sk-ant-`. Copy it somewhere safe; you'll paste it in a minute.

AI scoring and call prep need this key. Everything else in the app (import, interactions, follow-ups, backup) works without one.

## Setup, step by step

On macOS, open Terminal: press Cmd+Space, type "Terminal", hit Enter. On Windows, open "Git Bash" from the Start menu (not regular Command Prompt).

Type each command below and press Enter after each one.

**1. Pick a folder where the app will live.** Your Documents folder is fine:

```
cd ~/Documents
```

**2. Clone the repository.** I'll send you the URL separately:

```
git clone <REPO_URL>
```

This creates a new folder with the project in it.

**3. Step into the folder:**

```
cd account-workspace
```

(Your folder name may differ slightly depending on how the repo is named.)

**4. Copy the example environment file:**

```
cp .env.example .env
```

**5. Open the `.env` file in any text editor** (TextEdit, VS Code, Notepad, whatever you have). It will look like this:

```
ANTHROPIC_API_KEY=
```

Paste your key after the equals sign. No quotes, no spaces. Save the file.

```
ANTHROPIC_API_KEY=sk-ant-...
```

**6. Install dependencies:**

```
npm install
```

This takes 1 to 3 minutes. It downloads the code the app depends on and compiles a small local database library for your machine.

If it fails on macOS with a message about a compiler, run this once and try again:

```
xcode-select --install
```

**7. Start the app:**

```
npm run dev
```

You'll see a few lines of log output. Leave this Terminal window open. If you close it, the app stops.

**8. Open the app.** In your browser, go to:

```
http://localhost:3000
```

On a brand-new install the app takes you straight to Settings, because it won't show the dashboard until you've given it a workspace name and a Tier 1 definition. That's where the next section picks up, so this is expected — not a broken redirect.

## First-hour walkthrough

A guided tour. Do this once. It ends with you generating your first call prep.

### 0 to 5 minutes: Settings

Click Settings. Fill in three things:

1. **Workspace name.** Anything. "My accounts" works.
2. **Company description.** One or two sentences about what your company sells and to whom. This feeds the AI scoring prompt.
3. **Tier 1 definition.** Two sentences describing what an ideal account looks like for you. Industry, size, signals, anything relevant. The AI uses this to decide which accounts are Tier 1.

Tier 2 through 4 definitions are optional. Fill them in later once you've scored a few accounts and seen where the AI gets things wrong.

Save.

### 5 to 15 minutes: Import your accounts

Click Import. Drag in a CSV or XLSX of your current spreadsheet.

- The app auto-maps common header names (name, company, website, industry, location, headcount). Only a name column is required.
- XLSX files with multiple sheets will ask which sheet to use.
- Review the preview. If the name column looks wrong, rename it in your source file to `name` and re-import.
- Accept. You'll see how many rows were added and how many existing ones were updated.

Deduplication is by exact name match. "Acme Inc" and "Acme Incorporated" will become two separate rows, so clean obvious duplicates in your source first if that matters.

### 15 to 30 minutes: Score a handful

Open any account. Click **Research & score**. Wait about 30 seconds.

You'll get back a proposed tier, a confidence level, and an evidence block: funding detail with a source URL, countries found, hiring signals. Read it. Does it look like the right company? If not (especially with generic names), the evidence will tell you which company the AI ended up researching.

If the AI got it wrong, set a human tier using the override dropdown. Your override sticks, and re-scoring will never overwrite it.

Repeat on four more accounts to get a feel for it. Then try bulk scoring on a filtered slice, not all 500 at once. Start with 20 to 50 rows. If you hit rate limits, wait a minute and try a smaller batch.

### 30 to 45 minutes: Log an interaction

Pick an account you actually plan to reach out to (or pretend-dial one). On the account page, add an interaction:

- **Date.** Today.
- **Channel.** call, email, linkedin, whatsapp, meeting, or other.
- **Person.** Who you spoke to.
- **Outcome.** One of: no-answer, connected, replied, meeting, objection, dead.
- **Notes.** What they said, briefly.
- **Next step.** What you're going to do next.

Save. The interaction appears in the account's timeline, newest first.

### 45 to 55 minutes: Set a follow-up

On the same account, set a follow-up. Pick a date and write one line explaining why:

```
call after Q1 earnings on May 6
```

Go to the dashboard. The follow-up appears in the Upcoming bucket. If you set the date to today or earlier, it shows in Today or Overdue instead.

### 55 to 60 minutes: Generate call prep

Pick an account where you've written some notes and logged at least one interaction. Click **Call prep**.

The output has five sections: opener, qualifying questions, value bridge, CTA, and a likely objection with a handler. It's built from your notes, your interactions, your prospects, and the AI evidence already cached from scoring. It does not run a fresh web search.

If it feels thin, that's a signal your notes are thin. Go back and add detail.

## Daily rhythm

How the tool is meant to be used day to day:

- **Morning.** Open the dashboard. Clear overdue follow-ups first. Then today's.
- **During calls.** Log interactions as they happen, one row per touch. Don't batch.
- **End of day.** For anything live, set a follow-up date and a one-line reason.
- **Weekly.** Clear "needs review" (AI scores with low confidence and no human decision). Re-score any freshly imported accounts. Take a backup (see below).

## When things break

The five most likely issues and what to do.

**`command not found: npm` or `node` or `git`.** The prerequisite isn't installed, or your Terminal opened before you installed it. Reinstall from the links above and open a new Terminal window.

**`Error: listen EADDRINUSE :::3000`.** Something else is already using port 3000. Either close that app, or start the dev server on a different port:

```
PORT=3001 npm run dev
```

Then open `http://localhost:3001` instead.

**`ANTHROPIC_API_KEY not set` when you try to score.** The `.env` file is missing the key, has a typo, or you started the dev server before saving the key. Fix `.env`, stop the server (Ctrl+C in the Terminal window where it's running), and run `npm run dev` again.

**Rate limit errors during bulk scoring.** You're pushing too many scores too fast. Cancel the bulk job. Score smaller batches (20 to 50). Wait a minute between batches.

**Import is slow on a big XLSX.** XLSX parsing is heavier than CSV. Export to CSV from Excel or Google Sheets and re-import.

## Updating

When I push a new version and let you know:

```
git pull
npm install
```

Then restart the dev server (Ctrl+C in its Terminal, then `npm run dev` again).

## Backing up your data

In the app, go to Settings and use **Export backup**. You'll download a JSON file containing your settings, accounts, interactions, and prospects. Do this weekly.

If you prefer, the raw database lives at `data/workspace.db`. Copying that file is also a valid backup.

## Uninstalling

Stop the dev server (Ctrl+C). Delete the project folder. That's it. Nothing is installed system-wide.

---

If you hit a wall, DM me. I'd rather hear from you than have you give up quietly.

For the thinking behind the design, see [ABOUT.md](ABOUT.md).
