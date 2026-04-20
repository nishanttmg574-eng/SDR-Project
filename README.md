# Account Workspace

A local, single-user tool that replaces the target-account spreadsheet an SDR already keeps on the side, and adds structured interaction history, follow-ups, and AI scoring with evidence.

<!-- SCREENSHOT: dashboard overview -->

## What's in it

**Interaction log.** Every touch is a structured row (date, channel, person, outcome, notes, next step), not a free-text blob. You get a timeline per account and filters across accounts. "Show me everyone I connected with this week who didn't book" is a filter, not a search.

**Follow-ups with reasons.** A follow-up date without context rots. Every follow-up carries a `reason` field ("they said call after Q1 earnings") plus a snooze. The dashboard surfaces overdue, today, and the next seven days so nothing quietly slips.

**AI scoring with evidence.** When you ask the AI to score an account, it returns a tier plus the evidence it found: funding details with a source URL, countries the company is in, hiring signals, and a confidence level. You can read the work before you trust it. If you override the tier, the override is sticky, and re-scoring will not overwrite it.

Call prep is also in the app and uses your own notes rather than the open web. Details in [ABOUT.md](ABOUT.md).

## What it doesn't do

- No team features, sharing, or multi-user mode.
- No Salesforce, HubSpot, Gmail, or Outlook integration. No email sending, no sequencing.
- No contact data provider. It won't find new accounts or enrich contacts for you.
- No mobile UI. Works in a desktop browser.
- Dedup on import is exact-name only. "Acme Inc" and "Acme Incorporated" become two rows.
- Keyboard shortcuts are not wired up yet, even if earlier notes implied otherwise.
- It's beta software. Expect rough edges.

## Who this is for

- SDRs managing roughly 50 to 500 target accounts.
- People running a shadow spreadsheet alongside a company CRM that doesn't prioritize or personalize.
- Willing to do a one-time 20-minute setup (see the quickstart).

## Get started

Head to [QUICKSTART.md](QUICKSTART.md) for prerequisites and a guided first hour. If you've never cloned a repo before, the quickstart assumes that.

## Why I built this

The short version: the spreadsheet solves real problems the CRM doesn't, and kept pulling me back even when I tried to quit it. The long version is in [ABOUT.md](ABOUT.md).

## Feedback I'd like from you

Not "what do you think." These are more useful:

- Which spreadsheet columns did this actually replace for you?
- What made you open the spreadsheet anyway?
- Did you book meetings off the call-prep output? Roughly how many?
- What broke, and what felt confusing on day one?

One-line answers to all four beats a long essay on one.

## Ground rules

- Don't import customer or prospect data you don't have permission to hold on your personal machine. Check with your employer if unsure.
- Don't redistribute the app or the source code to anyone outside the beta.
- All data is stored locally. You are responsible for the security of your machine and your backups.

## Contact

_[contact: to be filled in]_
