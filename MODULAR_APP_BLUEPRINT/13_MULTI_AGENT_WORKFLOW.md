# Multi-Agent Implementation Workflow

## Goal

Allow several AI agents to work in parallel while preserving one coherent architecture, ordered migrations and auditable handoffs. The process is tool-neutral and applies to Codex, Claude, Antigravity or human contributors.

## Workstream ownership

Suggested workstreams:

| Workstream | Owns | Must coordinate with |
|---|---|---|
| Architecture/release | ADRs, contracts, integration order | all |
| Database/security | migrations, RLS, RPCs, generated types | every feature |
| App shell/design system | router, providers, shared UI, accessibility | feature UIs |
| Profiles/records | directory, profiles, professional records | DB, Drive |
| Requests | request lifecycle | DB, roster |
| Roster domain | pure engine and regression fixtures | DB, roster UI |
| Roster UI | workspace and lifecycle screens | domain, DB |
| Integrations | Drive, PDF, Telegram Edge Functions | DB, security, QA |
| Migration | source export, transforms, reconciliation | DB, owner |
| Quality/release | CI, E2E, UAT, deployment | all |

An agent may cover multiple workstreams, but two agents must not independently alter the same migration sequence or public contract.

## Dependency waves

### Wave A — parallel discovery/scaffold

- repository and CI;
- schema/RLS design refinement;
- design system/app shell;
- legacy fixture extraction and source inventory.

### Wave B — foundation

- auth/allowlist;
- base migrations and generated types;
- query/error conventions;
- migration raw layer.

### Wave C — feature slices

- profiles/records;
- requests;
- pure roster engine;
- document metadata.

### Wave D — critical workflows

- roster persistence/lifecycle;
- roster UI;
- Drive/PDF/Telegram;
- normalized migration and reconciliation.

### Wave E — integration/release

- end-to-end flows;
- security/accessibility review;
- rehearsal and cutover.

Do not start a dependent wave because an upstream PR merely exists; start when its contract is merged and tests pass.

## Task brief

Every task uses `templates/TASK_BRIEF.md` and declares:

- objective and non-goals;
- allowed files/modules;
- dependencies and contract versions;
- acceptance tests;
- security/data classification;
- migration/rollback impact;
- expected handoff.

## Branch and PR rules

- One task, one short-lived branch/worktree.
- Branch naming: `feat/<area>-<short-name>`, `fix/...`, `docs/...`.
- Rebase/merge current main before final verification according to repository policy.
- Keep PRs reviewable; separate schema foundation from large UI polish.
- Never push production credentials or real unmasked datasets.
- Do not commit generated build output unless the deployment design explicitly requires it.

## Contract-first coordination

Before parallel feature implementation, merge:

- database names and DTOs;
- error envelope;
- query key conventions;
- route ownership;
- design tokens and primitive components;
- operation/revision protocol.

Use temporary mocks that implement the merged contract. Do not create competing domain models in each feature.

## Migration serialization

Assign one migration integrator per wave. Other agents submit proposed schema diffs or depend on merged migrations. The integrator:

1. creates migrations through the supported CLI workflow;
2. resolves ordering;
3. adds indexes/RLS/tests;
4. regenerates database types;
5. publishes migration/version notes.

## Handoff standard

Each completed task supplies `templates/HANDOFF.md` content including:

- exact files/migrations changed;
- behavior and contracts added;
- tests run and results;
- unresolved risks;
- configuration/manual actions;
- next recommended task.

Claims such as “works” require evidence from named tests or observed output.

## Review pairing

- Database/RLS work reviewed by a security-minded agent not authoring the change.
- Roster calculations reviewed against legacy fixtures by a separate agent.
- UI reviewed for keyboard/mobile/accessibility by a separate agent.
- Integration code reviewed for secret exposure/idempotency.
- Migration scripts reviewed against reconciliation reports and source evidence.

## Conflict protocol

If two tasks discover incompatible requirements:

1. stop only the conflicting implementation area;
2. document evidence and impact;
3. create/update an ADR;
4. obtain owner/architect decision;
5. update affected blueprint/contract;
6. resume from the accepted decision.

Do not resolve architectural conflicts by whichever branch merges first.

## Agent bootstrap prompt

Use this at the start of an implementation task:

```text
You are implementing one task in the RESQ Modular App.
Read MODULAR_APP_BLUEPRINT/README.md, AGENTS.md, project-manifest.yaml,
the task brief, every referenced blueprint document, and accepted ADRs.
Inspect the current replacement repository before editing.
Stay within the task's files and non-goals. Preserve RLS, revision,
idempotency, append-only audit, migration evidence and accessibility rules.
Add tests, run the required suites, and finish with the HANDOFF template.
If a contract conflicts with the code or another document, stop that area and
raise an ADR; do not silently invent a third design.
```

## Parallelism limits

Good parallel tasks have separate file/module ownership and depend on stable contracts. Poor parallel tasks include two agents editing the same migration, both redesigning roster state, or separately implementing auth. Prefer fewer integrated workstreams over maximum agent count.

