# Holistic Audit Implementation Plan

## Executive Summary

This project is already a strong SDR portfolio artifact: it understands the shadow-spreadsheet workflow, keeps the user in control of AI outputs, stores data locally, and makes evidence visible before trust is granted. The next step is to make the product feel operationally sharper and technically safer: the app should tell an SDR what to do next, preserve data reliably, make AI behavior inspectable, and read as a deliberate OpenAI-relevant case study.

This plan turns the holistic audit into an implementation roadmap. It is intentionally scoped for a local-first, single-user beta and does not introduce enterprise CRM sync, team collaboration, sequencing, or mobile-native app work.

## Current Strengths

- The product thesis is clear: replace a personal SDR tracking sheet without trying to become Salesforce, HubSpot, or a sequencer.
- The core workflow is coherent: accounts, interactions, prospects, follow-ups, AI scoring, call prep, import, backup, and restore.
- The human-in-the-loop principle is reflected in implementation: AI score writes do not overwrite `human_tier` or `human_verified_at`.
- The local-first data model is easy to explain and appropriate for the target scale of roughly 50 to 500 accounts, with a stated upper bound of 2,000.
- The README and ABOUT narrative are candid about beta limitations, privacy boundaries, and what the app is not trying to be.

## Phase 1: Trust And Correctness Fixes

### Goals

Make the current product safer to trust before adding major new workflow surface area.

### Work Items

- Correct dashboard metric semantics:
  - Change the current "Follow-ups due" count so it includes only overdue and today follow-ups.
  - Add or expose a separate "Scheduled follow-ups" count for all future-dated reminders.
  - Rename "Touched this week" to "Touched last 7 days" unless calendar-week logic is implemented.
- Make account recency truthful:
  - Add a parent-account touch helper or a dedicated `last_activity_at` concept.
  - Update account activity recency when interactions or prospects are created, updated, or deleted.
  - Keep `updated_at` for account-field edits if a separate activity timestamp is introduced.
- Repair backup fidelity:
  - Include `call_prep_date` in JSON backup export and restore.
  - Add a backup round-trip test that fails when a persisted account column is omitted.
- Fix raw SQLite backup guidance:
  - Update docs to explain that WAL mode can write recent data to `workspace.db-wal`.
  - Recommend JSON export as the normal backup path.
  - If documenting raw file backup, instruct users to stop the app and copy `workspace.db`, `workspace.db-wal`, and `workspace.db-shm` together when present.
- Harden date validation:
  - Add a shared strict `YYYY-MM-DD` parser that rejects impossible dates.
  - Use it for interaction dates, follow-up dates, snooze calculations, and restore validation.
- Fix the lint workflow:
  - Replace `next lint` with a configured ESLint CLI command.
  - Ensure `npm run lint` runs non-interactively.

### Acceptance Criteria

- Dashboard cards no longer mislabel future follow-ups as due.
- Logging an interaction moves the account into the correct recent-activity ordering.
- Backup export and restore preserve `call_prep_date`.
- Invalid dates such as `2026-02-31` are rejected.
- `npm run lint` exits without opening an interactive prompt.

## Phase 2: SDR Morning Queue

### Goals

Turn the app from a better tracking sheet into a daily operating system for an SDR.

### Work Items

- Add a default "morning queue" view to the dashboard.
- Compute priority buckets in this order:
  - Overdue Tier 1 and Tier 2 follow-ups.
  - Today's Tier 1 and Tier 2 follow-ups.
  - Low-confidence AI-scored accounts without human verification.
  - Untouched Tier 1 and Tier 2 accounts.
  - Stale active accounts in `working` or `followup`.
  - Upcoming follow-ups.
  - Everything else.
- Define stale-account rules:
  - Tier 1 and Tier 2 accounts are stale after 7 days without interaction.
  - Tier 3 accounts are stale after 14 days without interaction.
  - Tier 4 accounts are not included in stale alerts by default.
- Make follow-up and stage semantics deterministic:
  - Setting a follow-up moves eligible accounts to `followup`.
  - Clearing the only follow-up on a `followup` account moves it back to `working`, unless the account is `meeting` or `dead`.
  - Logging a `meeting` outcome moves the account to `meeting`.
  - Logging a `dead` or disqualified outcome moves the account to `dead`.
- Improve follow-up completion from the interaction logger:
  - Replace the current implicit clear/snooze behavior with an explicit disposition.
  - Supported dispositions: complete and clear, no answer and retry, set new follow-up, meeting booked, mark dead.
- Add SDR-relevant dashboard metrics from interaction data:
  - Touches logged last 7 days.
  - Unique accounts touched last 7 days.
  - Connects and replies last 7 days.
  - Meetings booked last 7 days.
  - Overdue follow-ups.
  - Stale Tier 1 and Tier 2 accounts.

### Acceptance Criteria

- The first dashboard screen tells the SDR which accounts deserve attention next.
- A Tier 1 overdue follow-up ranks above a recently edited low-priority account.
- Follow-up state, stage, and interaction disposition do not drift apart.
- Metrics are derived from structured interaction data, not manual counters.

## Phase 3: Data Model And 2,000-Account Scale

### Goals

Make the local data model resilient enough for real spreadsheet imports and the stated 2,000-account upper bound.

### Work Items

- Add pagination or cursor paging to the account list:
  - Keep the default page size at 100.
  - Show total and filtered counts.
  - Preserve current filters and search params across pages.
- Improve import dedupe:
  - Add normalized-name logic for matching obvious duplicates.
  - Add domain-based duplicate detection when websites are present.
  - Warn before merging if multiple existing accounts match.
  - Avoid `LIMIT 1` ambiguity when duplicates already exist.
- Preserve spreadsheet context:
  - Store unmapped imported columns as `customFields` JSON on the account.
  - Show preserved fields in a compact "Imported fields" panel.
  - Ensure JSON backup and restore include custom fields.
- Harden restore:
  - Validate backup version before destructive replacement.
  - Validate account, interaction, prospect, settings, and custom-field shapes.
  - Reject duplicate IDs.
  - Validate foreign-key references before deleting existing data.
  - Validate enum fields, dates, and JSON fields.
  - Run `PRAGMA foreign_key_check` after restore inside the transaction.
- Introduce versioned migrations:
  - Use `PRAGMA user_version`.
  - Keep migrations transactional.
  - Test fresh database creation and upgrade from the current schema.

### Acceptance Criteria

- A seeded workspace with 2,000 accounts can be searched, filtered, and paged without hiding records behind a hard `LIMIT 500`.
- Import does not silently overwrite an arbitrary duplicate.
- Unmapped spreadsheet columns survive import, backup, and restore.
- Restore fails before deleting current data when a backup is malformed.

## Phase 4: OpenAI-Ready AI Layer

### Goals

Make the AI layer provider-aware, user-selectable, more reliable, and better aligned with the OpenAI SDR application story.

### Work Items

- Make AI choice a user-facing setting:
  - Add a clear provider selector in Settings with supported options such as OpenAI and Anthropic.
  - Show only models that belong to the selected provider, with a sensible default for each provider.
  - Allow advanced users to enter a custom model ID when needed.
  - Show provider-specific API key status and setup guidance without exposing full keys.
  - Disable scoring and call prep when the selected provider is missing its required API key.
  - Persist the user's selected provider and model locally with the rest of the workspace settings.
- Add an AI provider abstraction:
  - Define a common interface for scoring, call prep, provider configuration, and API key detection.
  - Keep the existing Anthropic path behind the interface.
  - Add an OpenAI implementation using the Responses API.
  - Store `provider` and `model` in settings.
  - Support `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` without logging either.
- Use structured output validation:
  - Define scoring and call-prep schemas once.
  - Validate all provider responses against the same schema.
  - For OpenAI, use Structured Outputs with a strict JSON schema.
  - Retry once on schema-validation failure.
  - Persist provider errors separately from schema-validation errors.
- Improve evidence quality:
  - Store field-level source objects with `url`, `title`, `snippet`, and `retrievedAt` where available.
  - Require sources for funding and hiring evidence.
  - Add source support for country evidence or mark unsourced countries clearly.
  - Downgrade or flag Tier 1 proposals when `entity_match` is low.
- Add AI output metadata:
  - Provider.
  - Model.
  - Prompt version.
  - Settings hash.
  - Input hash.
  - Tool configuration.
  - Provider request ID and usage metadata where available.
- Make stale AI outputs visible:
  - Mark scores stale when tier definitions, provider, model, prompt version, or core account inputs change.
  - Mark call prep stale when notes, prospects, recent interactions, scoring evidence, provider, model, or prompt version change.
- Improve bulk scoring reliability:
  - Block new jobs while a job is `running` or `cancelling`.
  - Add a terminal `cancelled` state.
  - Use job-scoped pending writes instead of a shared global write buffer.
  - Pass abort signals into active model calls.
  - Add retry with exponential backoff and jitter for transient provider failures.
  - Respect provider rate-limit headers when available.
  - Mark final job status as `error` if final writes fail.
- Protect human override invariants:
  - Add database constraints for `ai_tier`, `human_tier`, and `ai_confidence`.
  - Roll back or refresh optimistic UI state when human-tier updates fail.
  - Exclude human-verified accounts from default bulk scoring unless the user explicitly chooses to refresh AI evidence behind verified accounts.

### Acceptance Criteria

- Users can choose their AI provider and model from Settings before running scoring or call prep.
- Provider-specific API key readiness is visible before the user starts an AI action.
- The app can be configured to use OpenAI without rewriting scoring and call-prep call sites.
- Scoring responses are schema-validated before being written.
- Cancelling bulk scoring aborts active requests instead of waiting up to the full timeout.
- AI outputs show when they are stale relative to current settings or account inputs.
- Human tier overrides remain sticky at both application and database levels.

## Phase 5: UX, Accessibility, And Portfolio Polish

### Goals

Make the app feel polished in a demo, easier to use repeatedly, and clearer as an OpenAI SDR portfolio piece.

### Work Items

- Improve responsive behavior:
  - Make the account table horizontally scroll or switch to a stacked layout on narrow screens.
  - Make follow-up rows stack cleanly on small screens.
  - Prevent long workspace names from breaking the header.
  - Make account tabs horizontally scrollable with stable hit targets.
- Improve accessibility:
  - Add `aria-current` to active navigation, tabs, and filter links.
  - Add `aria-pressed` to toggle-like tier and filter buttons.
  - Add `role="alert"` to error messages.
  - Add `aria-live="polite"` to save, import, scoring, and restore progress states.
  - Ensure modal content has viewport margins, max height, and internal scrolling.
- Improve empty and error states:
  - Distinguish an empty workspace from a filtered-zero account list.
  - Show a quiet "No follow-ups due" dashboard state instead of hiding the section.
  - Add an autosave failure state and retry behavior for account notes.
  - Explain what improves call prep output: notes, prospects, recent interactions, and scored evidence.
- Update docs and screenshots narrative:
  - Fix README drift around "AI model selector" if the UI remains a text input.
  - Document that the user chooses their preferred AI provider and model in Settings.
  - Fix Quickstart wording that refers to an override dropdown when the UI uses tier chips.
  - Mark screenshots and demo data as synthetic/local.
  - Either use the source spreadsheet screenshot in the "Why this exists" story or remove the unused asset.
  - Mark `Project.md` as the original project brief or update stale dependency statements.
- Add OpenAI SDR portfolio framing:
  - Add a section titled "Why this matters for OpenAI SDR work."
  - Include the buyer pain, target user, discovery questions, likely objections, and a short demo script.
  - Frame the project as an AI workflow judgment case study: evidence-backed AI, local privacy, human override, and practical automation boundaries.

### Acceptance Criteria

- The dashboard and account detail pages remain usable on narrow browser widths.
- Interactive selected states are exposed to assistive technologies.
- Docs no longer describe UI controls that do not exist.
- The README makes the OpenAI SDR relevance explicit without misrepresenting the current implementation.

## Test Plan

### Unit Tests

- Date parsing rejects invalid calendar dates.
- Follow-up bucketing correctly separates overdue, today, upcoming, and future scheduled follow-ups.
- Dashboard stats count due follow-ups, scheduled follow-ups, touches, connects, replies, and meetings correctly.
- Import normalization handles case, punctuation, domains, blank fields, and duplicate candidates.
- Backup export and restore preserve every persisted account field.
- Restore rejects malformed backups before destructive replacement.
- AI score writes never overwrite human tier or human verification timestamp.
- AI schema validation rejects missing fields, bad enum values, and malformed evidence.
- Selected provider/model settings route scoring and call prep to the correct mocked provider.
- AI actions are disabled when the selected provider has no configured API key.

### Integration And Smoke Tests

- Create account, add prospect, log interaction, set follow-up, and complete follow-up disposition.
- Seed 2,000 accounts, then search, filter, and page through results.
- Run single-account scoring with a mocked provider response.
- Switch providers in settings and verify scoring/call prep use the selected provider.
- Run bulk scoring with mocked success, transient failure, schema failure, and cancellation.
- Restore a valid backup and verify accounts, interactions, prospects, settings, follow-ups, call prep, and custom fields.

### Required Commands

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## Implementation Order

1. Fix lint/test tooling and add the first test harness.
2. Correct dashboard and follow-up metric semantics.
3. Repair backup fidelity and restore validation.
4. Add activity recency and parent-account touch behavior.
5. Build the morning queue and follow-up disposition workflow.
6. Add pagination, dedupe, and custom-field preservation.
7. Introduce provider abstraction and OpenAI support.
8. Harden AI jobs, structured outputs, metadata, and stale-state indicators.
9. Polish responsive UI, accessibility, and docs.

## Assumptions And Out Of Scope

- The app remains local-first and single-user.
- Team collaboration, deployment, real-time sync, Salesforce/HubSpot integration, Gmail/Outlook integration, sequencing, and mobile-native apps remain out of scope.
- OpenAI support should be added through a provider abstraction rather than immediately deleting Anthropic support.
- The user, not the codebase default alone, decides which supported AI provider and model the workspace uses.
- The first implementation pass should favor correctness and demo credibility over broad feature expansion.
- All product metrics should be derived from structured interaction and account data, not manually entered vanity counters.
