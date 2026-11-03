# ADR-003: Google Drive stores document bytes; Supabase stores metadata

- Status: Accepted
- Date: 2026-11-03

## Context

Existing workforce documents already use Google Drive. Users need easier organization and search without duplicating file storage.

## Decision

Use a new controlled Drive hierarchy for files and Supabase for document metadata, access context, hashes, status and search. Prefer Shared Drive ownership; use dedicated-user OAuth only if necessary.

## Consequences

- Preserves familiar Drive workflows and organizational ownership.
- Requires credential management and reconciliation for manually moved/deleted files.
- File IDs, not paths, are stable identifiers.

## Verification

Permission tests, upload/retry tests and periodic catalog reconciliation.

