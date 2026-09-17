# Taster Session Deployment Readiness

## Purpose

The canonical Taster Session request model reuses the existing `trialtrainings` MongoDB collection.
Normal candidate release preflight enforces only its current pending-email persistence prerequisite.
The broader data audit, index initialization, template reconciliation, and historical cutover work
remain separately owned maintenance or migration activities.

The gate is aggregate-only: it reports counts and blocker codes, never visitor email addresses,
message content, administrator notes, or other personal data.

## Shared-Source Cutover Gate

Taster Session now reads venue and recurring weekly-time facts only from shared Locations. Before a
retained environment is switched to this source, compare its raw legacy `Settings.trialTraining`
definitions with the shared Location slots:

```bash
pnpm --filter @club/api audit:taster-session-source
```

The command is read-only by default. It matches by normalized address, weekday, and complete time
range; reports obsolete `capacityPerSlot` values without treating them as runtime capacity; and
stops on missing, ambiguous, conflicting, invalid, or unclassified policy evidence. Legacy
identifiers are never copied as shared Location or slot identity.

When every mapping is exact, applying the transfer remains a separate environment-specific
operation. It requires `TASTER_SESSION_SOURCE_CONSOLIDATION_APPLY=confirmed` and the explicit apply
command:

```bash
TASTER_SESSION_SOURCE_CONSOLIDATION_APPLY=confirmed \
  pnpm --filter @club/api apply:taster-session-source
```

Apply transfers only Taster enablement and accepted visitor categories to the matched shared slots.
It does not overwrite shared venue/time facts or delete, unset, or rewrite raw legacy Settings data.
Any shared-fact change between inspection and apply stops the transaction. An explicitly approved
unrestricted shared slot may be supplied using the fact-bound `approval` key reported by the audit
when it has no legacy mapping and no explicit policy:

```bash
TASTER_SESSION_SOURCE_CONSOLIDATION_APPLY=confirmed \
  pnpm --filter @club/api apply:taster-session-source -- \
  --approve-unrestricted-slot=<approvalKey>
```

Record that approval without copying runtime data into repository documentation.

This source gate is separately authorized per retained environment and is not proof that cutover
has occurred in production. It does not replace the request-data, email-template, and index gates
below.

## Required Environment Check

Run the read-only audit in every non-resettable target environment:

```bash
pnpm --filter @club/api audit:taster-session-readiness
```

The audit checks:

- legacy `contacted`, `no_capacity`, and `archived` business statuses;
- unknown or missing statuses;
- missing archive or delivery fields;
- old appointment and processing fields;
- missing or non-normalized email values;
- duplicate `pending` requests by normalized email; and
- the exact partial unique pending-email index.

Normal release preflight consumes only canonical pending-email data, duplicate normalized pending
groups, and the exact named partial unique index from that evidence. Legacy status, lifecycle, and
terminal-data findings remain broad retained-data diagnostics rather than universal normal-release
blockers. In particular, do not infer mappings from `contacted`, `no_capacity`, or legacy
`archived`. A Product Owner must explicitly approve the business mapping and a separately reviewed,
rollback-capable migration before those records are changed.

## Index Gate

The broad audit remains the retained-data diagnostic report. Its legacy or terminal-data findings
do not veto explicit index initialization. Run the Taster Session-only email-template preflight
separately; it reads all four legacy-to-canonical mappings and stops before any template mutation
when customized legacy content is unresolved:

```bash
pnpm --filter @club/api preflight:taster-session-email-templates
```

After that preflight passes, apply the scoped reconciliation. The apply command repeats the
preflight before creating canonical replacements or deactivating recognized legacy system
defaults; it never changes another capability's templates:

```bash
pnpm --filter @club/api reconcile:taster-session-email-templates
```

A customized legacy template reaches a resolved state when its content remains stored but the
template is inactive, and its canonical replacement is active with the required locale and
variable contract. Index initialization is independent of this template flow:

```bash
pnpm --filter @club/api check:taster-session-readiness
```

This command evaluates the narrow pending-email prerequisite before making any change. It may
create the complete schema-declared Taster Session index manifest when only diagnostic legacy or
terminal data remains, including the named partial unique pending-email index. It fails closed
before mutation for missing or non-canonical pending email, duplicate normalized pending groups,
or a conflicting named pending-email index, and rechecks the exact prerequisite after index
creation. It does not update or delete request documents. The model declares the same manifest
with `autoIndex: false`, making `diffIndexes()` a safe consistency check without giving normal
runtime initialization mutation ownership.

Normal production deployment runs the candidate's compiled read-only runtime preflight before
Web/API mutation. It blocks only when the exact named partial unique pending-email index is absent
or incompatible, the named index conflicts, pending email is missing/non-canonical, or duplicate
normalized pending requests prevent the required persistence invariant. Broad Taster audit findings
remain visible diagnostics and do not stop an otherwise safe release. Template reconciliation and
index ensure remain separately invoked maintenance or initialization operations rather than normal
deployment hooks. The reconciliation rechecks its preflight immediately before applying changes.

## Rollback and Evidence

Before an approved data migration, verify the target, backup or snapshot, expected record counts,
mapping decision, rollback steps, and representative migration tests. Index-only rollback consists
of dropping `one_pending_taster_session_request_per_email`; do this only through an explicitly
approved operational rollback, because removing the index also removes persistence enforcement of
the one-pending-request rule.

Required pull-request evidence for each non-resettable environment:

- environment identifier and check time;
- aggregate shared-source comparison result and any explicit unrestricted-slot approvals;
- whether the separately authorized Taster policy transfer was required and completed;
- aggregate report with no personal data;
- whether a legacy-data migration was required;
- approved mapping and migration reference when applicable;
- final index state; and
- operator confirmation that customized legacy Taster Session email-template warnings were
  resolved.
