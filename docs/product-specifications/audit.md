# Audit

## Purpose

Audit provides administrators with bounded operational traceability for capability-owned business
changes. It is not application logging, event sourcing, compliance analytics, or a general
history/reporting platform.

## Ownership Boundary

The capability performing a business change owns:

- whether an Audit record is required for that change;
- whether the write must participate in the business transaction or may be best effort; and
- which bounded business facts must remain traceable.

Audit owns:

- the privacy-minimized common record and read mechanics;
- bounded event and entity identity;
- actor and human/scheduled source presentation;
- the administrator-only current-store inspection surface; and
- current-store retention mechanics.

Audit does not own the business transition or define a central completeness matrix for every
capability event.

## Record and Read Boundary

Audit records retain only the bounded facts needed for operational traceability: business event
and entity identity, actor identity and role, human or scheduled source, an optional reason, and a
bounded set of changed-field facts. They do not retain actor email, request IP or user agent,
arbitrary metadata, raw request or transport context, or diagnostic payloads.

The current actor display name may be resolved when records are read. That lookup is a presentation
convenience, not a requirement to retain contact details, request metadata, or a complete
historical person snapshot.

Administrators may inspect the current Audit list, one record detail, and current-scope entity
history. Filters and page-local search remain bounded to those operational tasks. Audit does not
introduce global text search or broader historical claims.

## Write Reliability

Required and best-effort writes remain distinct. A capability whose loss boundary requires Audit
must write the record in the same transaction as its business change. Explicitly non-blocking
coverage may use the bounded best-effort path. Audit does not weaken or reinterpret that
capability-owned choice.

## Retention

Audit uses one current store with a 24-month retention period. Retention maintenance is an explicit
operator action: the maintained command reports a dry run by default and deletes eligible records
only when apply is separately requested. There is no archive collection or HTTP retention-delete
action.

## Non-Goals

Audit does not provide generic export, analytics or trend dashboards, immutable or compliance
archives, arbitrary metadata capture, application diagnostics, event sourcing, or a generic
history platform.

## Documentation Boundary

This document owns the maintained Audit product boundary. Each capability specification remains
authoritative for its business transition and required traceability facts. Current implementation
facts belong to Project Memory and repository evidence.
