# ADR-004: Immutable roster PDFs and personal Telegram delivery

- Status: Accepted
- Date: 2026-11-03

## Context

The owner wants monthly audit PDFs in Drive and an easy path to share them from a phone. Telegram is not intended for staff distribution.

## Decision

Manually create immutable versioned snapshots in Drive. After archive succeeds, allow the owner to send the exact file to one fixed private Telegram chat. Telegram failure does not affect Drive archive status.

## Consequences

- Simple mobile handoff to WhatsApp or other apps.
- Every amendment archive remains independently auditable.
- Forwarded Telegram copies are outside application access revocation.

## Verification

Hash equality, fixed-chat enforcement, non-owner denial and idempotent retry tests.

