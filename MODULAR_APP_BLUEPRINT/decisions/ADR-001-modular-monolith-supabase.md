# ADR-001: Modular monolith with Supabase backend

- Status: Accepted
- Date: 2026-11-03
- Deciders: Product owner and architecture blueprint

## Context

The existing SPA is difficult to maintain because large React and Apps Script files mix UI, state, rules and persistence. The replacement must remain practical for a small team and static hosting.

## Decision

Build one modular React/TypeScript SPA backed by one Supabase project. Separate feature modules, pure roster rules, RLS-protected tables, atomic database commands and Edge Functions provide boundaries. Do not introduce microservices for the first release.

## Consequences

- Easier deployment and cross-feature transactions.
- Clearer module ownership for multiple agents.
- Requires discipline and dependency rules to prevent a new monolith.
- Supabase becomes a critical managed dependency.

## Verification

Dependency-boundary review, feature-level tests and no privileged third-party calls from browser modules.

