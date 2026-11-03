# ADR-006: Separate Supabase staging and production projects

- Status: Accepted
- Date: 2026-11-03

## Context

The application requires safe schema iteration, migration rehearsal and UAT without risking the production database or authentication configuration.

## Decision

Use Supabase project `hgrutigkgnrcjhcjxabs` for development, testing, migration rehearsal and UAT. Reserve project `bubvwijyaqfbugsaedxp` for production. Agents may not alter production until a reviewed release task explicitly authorizes production deployment.

Publishable project keys may be used in the corresponding frontend environment. Secret/service-role keys remain server-side and environment-specific.

## Consequences

- Destructive development and test operations remain isolated from production.
- Schema, Edge Functions, Auth settings and seed/reference data must be promoted through a documented release process.
- Environment drift must be checked before release.
- Supabase dashboard/tool access must be granted deliberately to approved accounts.

## Verification

- Local development points to the staging URL.
- CI and preview builds never use production secrets.
- Release manifests compare staging-tested migrations/functions with production deployment artifacts.
- Production changes require explicit approval and post-deployment smoke tests.

