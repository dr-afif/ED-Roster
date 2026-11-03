# Roster Rules Engine

## Purpose

The rules engine provides deterministic calculations and advisory warnings for drafting, publishing and amending rosters. It does not make staffing decisions or silently change assignments.

The legacy Major Roster Update specification at the baseline commit is the compatibility source. This document defines how those rules fit the new Supabase architecture.

## Pure engine contract

```ts
type RulesInput = {
  period: RosterPeriod;
  people: StaffRosterIdentity[];
  planned: Assignment[];
  current: Assignment[];
  adjacentDates: Assignment[];
  requests: RosterRequest[];
  ledger: GoffPosition[];
  configuration: VersionedRuleConfiguration;
};

type RulesOutput = {
  issues: RosterIssue[];
  weeklyOff: WeeklyOffResult[];
  staffing: StaffingResult[];
  sequences: SequenceResult[];
  goffProjections: GoffProjection[];
  checksum: string;
};
```

The engine has no network, database, clock or browser dependency. Dates and timezone are explicit inputs. Identical canonical input produces identical output and checksum.

## Shift semantic model

All calculations share one versioned semantic mapping.

| Class | Initial codes | Consecutive sequence | Staffing coverage |
|---|---|---|---|
| Worked | `AM`, `PM`, `AMX`, `PMX`, `ON`, `ON1`, `ON2`, `N`, `NIGHT`, `OH`, configured duties | Increment | Configured yes |
| Transparent | `PN` | Preserve count without increment | No |
| Reset/non-working | `OFF`, `GOFF`, `AL`, `MC`, `EL`, `HKA`, `GHKA`, `COURSE`, blank, configured statuses | Reset | No |
| Unknown | Unmapped raw code | Do not guess | Do not assume |

Modifiers such as `(S)` and `(X)` inherit the base code unless an explicit validated override exists. Unknown values are preserved and surfaced as blocking publication issues until mapped or explicitly accepted under a controlled exception.

## Weekly OFF policies

Invariants:

1. A roster week is Monday through Sunday.
2. Evaluation loads adjacent-month/year dates required to complete all visible weeks.
3. Each policy effective date is a Monday.
4. Policy A requires one exact normal `OFF` per person per week.
5. Policy B requires one normal `OFF` if the immutable planned week includes a qualifying `ON1`, `ON2`, `PN`, `ON`, `N` or `NIGHT`; otherwise it requires two.
6. Only the base code `OFF` satisfies the entitlement. GOFF, leave, absence and other non-working codes do not.
7. Publication locks the policy version selected from the Monday `week_start`.
8. Later amendments do not retroactively change the planned qualification or requirement.
9. A week touching an unpublished adjacent period is `provisional`, not compliant or short.
10. The second period supplies only its owned dates and cannot overwrite the first period.

The UI shows planned compliance and current operational OFF outcome separately.

## Roster lifecycle

```text
Draft --publish--> Published --first active amendment--> Amended
                       ^                                  |
                       |---- reverse final amendment -----|

Published/Amended --manual reconcile and close--> Closed
Closed --reasoned reopen--> Published or Amended
```

### Draft

- Mutable and autosavable.
- Not official to staff.
- Shows projected staffing, OFF, sequence and GOFF results.
- Safe edits may be queued and coalesced.

### Publish

One atomic database command:

- validates owner, operation ID and expected revision;
- validates all dates and mappings;
- copies immutable planned assignments;
- locks rules, thresholds and week-policy snapshots;
- calculates checksum and publication metadata;
- creates GOFF reservations where applicable;
- writes audit record;
- changes the period to Published.

No Drive/PDF call occurs inside this transaction.

### Amend

Published cells are never directly overwritten. An amendment creates one event with one or more linked lines. Supported categories:

- absence only;
- absence plus replacement;
- shift swap;
- administrative correction;
- reversal.

Preview must show original/current/proposed values, staffing before/after, weekly OFF effect, GOFF effect, sequence/rest warnings and affected people. Linked lines commit atomically.

### Close/reopen

Closing is always manual and requires a reconciliation preview. Pending/failed official operations, ledger mismatch or unmapped blocking shift codes prevent close. Eligible pending earns/reservations convert to final ledger entries in the close transaction.

Reopen requires confirmation, reason, actor, operation ID and revision increment. It never deletes close or amendment history.

## Planned and current assignments

```text
immutable planned assignment
  + ordered active amendment lines
  = current operational assignment
```

Views:

- Current roster — default operational view.
- Original planned — exact publication snapshot.
- Changes — event history and affected cells.

A reversal appends compensating events. It never deletes or edits the original event.

## Consecutive work and night sequences

- Recommended maximum worked sequence defaults to six.
- A proposed seventh worked day creates an advisory acknowledgement, not an automatic block.
- `PN` is transparent: neither increments nor resets.
- Reset/non-working statuses end the sequence.
- Validate continuously across week, month and year boundaries.

Recognized night patterns initially:

```text
ON1 → ON2 → PN
ON1 → PN
ON / N / NIGHT → PN
```

A night followed directly by another non-bundle worked shift without PN creates bundle and rest warnings. A night followed by a reset/non-working status protects rest but may retain a bundle-integrity warning.

## Staffing

- Minimums are effective-dated and versioned by day type, shift bucket and optional staff group.
- Amendment previews show counts before and after.
- If an absence drops below minimum, replacement is recommended.
- The owner may accept a shortage only with a reason and audit event.
- Replacement suggestions exclude or warn for clashes, leave/OFF/GOFF, insufficient rest, excessive sequences and OFF shortfall.
- Initial suggestions state `Eligibility not checked` until a verified competency source is implemented.

## GOFF rules

```text
current balance = opening + earned - used +/- adjustments
available = current - active reservations
projected = available + pending earns - draft/proposed uses
```

- Whole-day units, carried indefinitely.
- A planned normal OFF displaced by configured duty or required PN creates one pending earn.
- Ordinary MC/EL/AL displacement does not automatically earn GOFF.
- Working a planned GOFF releases/non-consumes the reservation and does not earn another credit.
- Published future GOFF creates a reservation.
- Pre-close cancellation releases it.
- Close converts eligible pending earn to earn and reservation to use.
- Negative available balance is blocked unless a deliberate reasoned override is audited.
- Source uniqueness and operation IDs prevent duplicate entries.
- Production GOFF starts only at the confirmed first native period with reconciled opening balances.

## Issues panel taxonomy

At minimum:

- staffing shortage;
- missing normal OFF;
- GOFF unavailable/negative override;
- night-bundle integrity;
- consecutive work;
- post-night rest;
- duplicate/conflicting assignment;
- incomplete boundary week;
- unknown shift mapping;
- failed/pending save;
- revision conflict;
- close/reconciliation blocker.

Each issue has stable code, severity, person/date/week context, plain-language explanation, suggested resolution, source rule version and acknowledgement/resolution state.

## Editable rules boundary

The owner requested rules, calculations and formulas to be manageable from Settings. Implement this safely as follows.

### Editable without a code release

- thresholds and limits;
- policy selection and Monday effective dates;
- shift semantic mappings;
- worked/reset/transparent classification;
- staffing buckets;
- request lead times and quotas;
- consecutive-day warning threshold;
- active record types and expiry warning windows;
- simple validated expressions from a documented, non-Turing-complete DSL if necessary.

### Requires a code release

- database authorization logic;
- lifecycle transitions;
- ledger posting algorithm;
- amendment atomicity;
- idempotency/revision behavior;
- arbitrary new functions or unrestricted formulas;
- any executable JavaScript or SQL.

### Rule activation workflow

1. Clone active version into Draft.
2. Edit through typed controls.
3. Validate schema and cross-field invariants.
4. Preview impact against representative historical/synthetic cases.
5. Enter change reason and effective date.
6. Activate as a new immutable version.
7. Existing publications retain referenced versions.
8. Audit old/new hashes and actor.

## Engine test corpus

Port representative legacy cases for:

- cross-month and cross-year OFF weeks;
- Policy A/B qualification;
- PN transparent sequences;
- all recognized night bundles;
- planned OFF displacement and one-time GOFF earn;
- GOFF reservation/use/release/reversal;
- linked replacement atomicity;
- reversal dependency blocking;
- duplicate retry idempotency;
- unknown code preservation;
- historical read-only behavior.

Every rule version change must run the corpus and produce an impact report before activation.

