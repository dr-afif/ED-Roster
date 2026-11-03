# ADR-002: Import Sheets and stop operational dual-write

- Status: Accepted
- Date: 2026-11-03

## Context

Prior Supabase migration trials were problematic. Maintaining Sheets and Supabase as simultaneous writable sources would create reconciliation and ownership ambiguity.

## Decision

Use the live Sheets workbook as a read-only migration source. Preserve raw exports and normalize into Supabase. After cutover, Supabase is the only operational source; historical Sheets remain audit/reference only.

## Consequences

- Clear ownership and simpler application logic.
- Requires strong export, reconciliation and rollback process.
- No staging Google Sheet is required; isolated Supabase environments provide rehearsal safety.

## Verification

Reconciliation reports, no production Sheets write endpoint in the replacement, and network/E2E checks.

