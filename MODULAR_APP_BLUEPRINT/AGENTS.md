# Agent Operating Contract

These instructions apply to every human or AI agent working from this blueprint.

## Before changing code

1. Read `README.md`, `project-manifest.yaml`, and every blueprint document relevant to the task.
2. Read all accepted ADRs.
3. Inspect the replacement repository's current code, migrations, tests, and worktree status.
4. Confirm that the task has explicit acceptance criteria and permitted files.
5. Verify current Supabase, Google Drive, Telegram, and GitHub Pages documentation before implementing an integration.

If a task has no acceptance criteria, create or refine the task brief before coding.

## Non-negotiable constraints

- Do not modify or deploy the legacy `dr-afif/REQUEST-APP` repository unless the owner explicitly requests a legacy hotfix.
- Never write migration experiments to the live Google Sheets workbook.
- Never expose Supabase secret/service-role keys, Google private keys or refresh tokens, Telegram bot tokens, or Drive credentials in browser code, Git, logs, screenshots, fixtures, or AI prompts.
- Never use client-side role checks as the security boundary. RLS or an authenticated server function must enforce every protected operation.
- Enable RLS on every table in an exposed schema and test both permitted and forbidden cases.
- Do not authorize with user-editable `user_metadata`.
- Do not introduce arbitrary JavaScript, SQL, or `eval`-style formulas into editable settings.
- Do not overwrite published roster snapshots, archived PDFs, amendment history, ledger entries, or audit events.
- Do not infer historical GOFF, weekly OFF compliance, or planned assignments from overwritten legacy cells.
- Do not silently use last-write-wins for roster or settings conflicts.
- Do not expand scope during a task. Record proposed additions in the open-questions log.

## Architecture boundaries

- Feature modules may depend on shared platform code; shared platform code must not depend on feature modules.
- UI components do not call privileged third-party APIs directly.
- Browser code uses a publishable Supabase key only.
- Edge Functions coordinate Google Drive and Telegram.
- Database RPCs own atomic roster lifecycle and ledger transactions.
- The rules engine is pure and deterministic. It receives data and a versioned rule configuration and returns results without network access.
- Imported legacy records remain distinguishable by `source_system` and import batch.

## Required workflow

1. Create a task brief from `templates/TASK_BRIEF.md`.
2. Claim one primary module or migration range; avoid overlapping ownership.
3. Add or update tests before considering the task complete.
4. Run focused tests, then the full affected suite.
5. Run database and security advisors for schema/RLS work.
6. Update documentation, the decision log, and handoff notes where behavior changed.
7. Produce a handoff using `templates/HANDOFF.md`.

## Database rules

- Use lowercase snake_case identifiers.
- Use `bigint generated always as identity` for internal high-write entity/event IDs unless a public UUID is required.
- Use `timestamptz` for instants and `date` for roster calendar dates.
- Add database constraints for invariants; client validation is supplementary.
- Index every foreign key and every column used in RLS predicates.
- Use composite indexes that match actual equality/range query patterns.
- Use partial indexes for stable filtered queues such as `status in ('queued','failed')`.
- Use atomic upserts rather than select-then-insert.
- Keep transactions short. Do not make Drive or Telegram HTTP calls while holding database locks.
- Acquire linked roster/person locks in a consistent order.
- Every retryable command needs a unique idempotency key and a unique constraint.

## Security review triggers

Require a focused security review when a change touches:

- Google sign-in, sessions, approved email handling or account linking;
- roles, RLS, views, database functions, `security definer`, or service credentials;
- private staff records or document links;
- PDF generation, Drive uploads or Telegram delivery;
- audit retention or destructive operations; or
- deployment configuration and environment variables.

## Definition of done

A task is done only when:

- acceptance criteria pass;
- tests cover success, failure, authorization denial, retry and conflict paths where relevant;
- no secret or production identifier is committed;
- accessibility is checked for UI work;
- migrations can be applied from a clean database and rolled forward predictably;
- the implementation matches the documented contract; and
- a different agent can continue from the handoff without guessing.

