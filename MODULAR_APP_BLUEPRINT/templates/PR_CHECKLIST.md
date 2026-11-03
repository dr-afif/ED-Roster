# Pull Request Checklist

## Scope

- [ ] Linked task brief and traceability requirement.
- [ ] Change stays within declared scope/non-goals.
- [ ] Relevant ADRs and blueprint contracts followed.

## Data and security

- [ ] No secret, token, private key, production identifier or real sensitive fixture committed.
- [ ] RLS enabled/tested for exposed tables.
- [ ] Negative authorization tests included.
- [ ] Idempotency/revision/audit behavior preserved where applicable.
- [ ] Personal/private fields are not over-fetched or logged.

## Database

- [ ] Migration applies from a clean database.
- [ ] Foreign keys and policy/query columns are indexed.
- [ ] Constraints enforce critical invariants.
- [ ] Generated types updated.
- [ ] Advisors reviewed.

## UX/accessibility

- [ ] Loading, empty, success, error and retry states handled.
- [ ] Keyboard and visible focus verified.
- [ ] Mobile layout and 44×44 targets verified.
- [ ] Color is not the only state indicator.
- [ ] Reduced motion/zoom considered.

## Verification

- [ ] Focused tests pass.
- [ ] Full affected suite passes.
- [ ] Production build passes.
- [ ] Handoff completed.
- [ ] Documentation/decision/traceability updated if behavior changed.

