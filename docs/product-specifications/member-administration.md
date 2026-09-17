# Member Administration

## Purpose

Member Administration gives administrators one primary Member-management surface, a bounded
read-only overview of active External Players, and CSV tools for ordinary club administration. It
does not create a new lifecycle state, attendance model, generic reporting system, or import
framework.

## Administration Surface

### Members

Members is the primary lifecycle-administration surface. It retains the established current,
active, passive, inactive, and all filters and excludes accounts represented as active External
Players. This surface owns existing Member setup, correction, designation, access, lifecycle, and
guarded cleanup actions.

### Active External Players

Active External Players is a secondary read-only overview for the bounded operational question of
who is currently eligible as an External Player and how an administrator can identify or contact
them. It uses the existing Player projection and includes only External Players whose effective
eligibility is current.

The overview contains only name, email, and singles/doubles ranking. It has independent loading,
empty, and failure states, and does not duplicate Members or expose Player lifecycle, Team,
ranking-mutation, or setup actions. Player management remains in the Players surface.

## Filtering and Statistics

The Member surface supports name/email search and gender filtering. The gender filter options show
counts for the searched base cohort before the selected gender is applied. Statistics describe the
full selected Member cohort, not only the current pagination page, and explicitly retain people
whose gender or birth date is missing.

## CSV Data Tools

Member Administration offers four export actions, independent from list search, filters, and pagination:

- **Portable Member CSV (current Members):** active and passive Members in the shared Import contract below. This replaces Basic Current Members; canonical first/last names, dates, and structured address fields are exported directly, with missing source facts left blank. The filename is `members_portable_current_<YYYY-MM-DD>.csv`.
- **Basic CSV (all retained Members):** name, email, gender, birth date, and Membership status for active, passive, and retained inactive Members.
- **Rich CSV (current Members / all retained Members):** reporting/archive variants with identity and Membership facts, contact/address, administrator designation, and bounded Player ranking, participation, and Team-name facts.

Portable CSV is directly accepted by Import. Basic All and Rich exports remain reports rather than Import templates. Portable does not offer an inactive cohort or imply former-Member reactivation. `Ensure Player` is `true` only for an active Member Player and blank otherwise. Its string encoding reversibly escapes spreadsheet-dangerous leading characters and genuine leading apostrophes, preserving values such as `+49` phone numbers on re-import. Unescaped manually authored supported values remain accepted.

The rich export must not expose credentials, password-setup tokens, session data, audit payloads,
or other security-sensitive fields. CSV generation quotes values and neutralizes cells that could
be interpreted as spreadsheet formulas.

Competition Team administration also provides a **Team roster CSV** for one selected Team. It is
derived from the existing `Player.teamIds` relationship and the current authoritative Player
eligibility result; it does not introduce a second roster owner. Its fields are name, gender,
Player type, singles ranking, and doubles ranking.

## Ownership Boundaries

Membership Lifecycle remains authoritative for Membership state and membership-driven Player
transitions. Player identity and eligibility remain authoritative for sporting participation, and
Competition remains authoritative for Team relationships. Member Administration consumes those
facts without reinterpreting or persisting them.

## Recurring Member CSV import

Member Administration's CSV menu provides a bounded import modal for its Portable Member CSV.
Import accepts UTF-8 comma-separated
CSV (BOM allowed), up to 1 MiB and 1,000 data rows. Every header below must occur exactly once;
column order is free:

```text
First Name,Last Name,Email,Gender,Date of birth,Phone,Street,Postal code,City,Membership status,Membership type,Ensure Player
```

Names, email, gender (`male`, `female`, `other`), canonical `YYYY-MM-DD` birth date, and Membership
status (`active` or `passive`) are required. Membership type is optional (`regular` or `student`).
Ensure Player accepts `true`, `false`, or blank. Phone and the complete German address group are
optional; blank optional values do not clear stored facts. Missing/unknown/duplicate headers fail
closed. Duplicate normalized emails are invalid; matching name/DOB with different emails requires
review, both within the file and against current canonical identities.

Preview makes no persistence or Audit changes. It shows create, update, unchanged, review required,
conflict, and invalid row outcomes. Existing names/DOB must match; only gender, explicit phone and
complete address are batch-updateable. Existing current Member type mismatches require manual
review. Import reconciles only active/passive Membership, and can convert compatible External
Players through Account Onboarding while preserving their Player identity. A positive Ensure Player
ensures active Member Player eligibility; false/blank never deactivates a Player or removes Teams.
Inactive ordinary Persons, suspended/protected accounts, and contradictory Player state are held.
No password-setup email is sent.

Apply requires a current preview of the same file and actor, rechecks current state, and commits
independently safe rows through existing domain owners in one transaction per row. A deleted,
replaced, or materially changed target requires another preview; exact safe convergence is allowed.
The short-lived `previewContext` binds actor, exact file, row outcomes/targets, and only the expected values of facts to be overwritten or transitioned. It is untrusted client-pass-through data, not authorization or retained history. A concurrent phone correction blocks a phone overwrite but does not block a Membership-only change.

The file is not atomic: already committed rows remain if a later row or infrastructure operation fails. After incomplete or uncertain Apply, the modal discards Apply authority and asks for **Preview again** with the selected file. Fresh Preview shows already-converged rows as unchanged and identifies remaining work. There is no same-context retry, durable batch identity, preview store, or resumable job. Row command IDs exist only within one request and remain stable for database transaction-callback retries. Correct applied data through normal administration; code rollback does not reverse business data.

Existing lifecycle-required and profile best-effort Audit semantics remain. After a normal completed/partial Apply with actual business mutations, a supplemental aggregate summary is attempted through the Audit owner. Summary failure returns an `auditSummary` warning without changing verified business success or replaying mutations. No raw CSV, row identity, contact values, file digest, or credentials are retained in the aggregate. Unchanged imports need no mutation summary.

Member CSV portability is secondary to MongoDB backup/restore for disaster recovery; it cannot restore complete database or Competition state.

Import has no authority over email changes, account designation/suspension, termination/reactivation,
Player removal, rankings, preferences, Team rosters, Match state, banking, credentials, or database
restoration. It introduces no persistent CSV store or separate import-history collection.
