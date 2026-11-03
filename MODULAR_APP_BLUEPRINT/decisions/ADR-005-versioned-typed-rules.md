# ADR-005: Versioned typed rule configuration, not executable formulas

- Status: Accepted
- Date: 2026-11-03

## Context

Operational policies and thresholds change, and the owner needs a settings page. Storing arbitrary code would create security, testing and audit risks.

## Decision

Expose typed parameters, semantic mappings, thresholds, effective dates and, only if needed, a small validated expression language. Core lifecycle, ledger and authorization algorithms remain versioned application/database code. Activating a rule creates an immutable version.

## Consequences

- Most policy changes need no deployment.
- Complex algorithm changes still require a reviewed release.
- Historical roster calculations remain reproducible through version references.

## Verification

Schema validation, effective-date constraints, impact preview and regression corpus on activation.

