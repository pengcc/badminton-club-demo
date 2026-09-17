# Open Findings

This document is a small buffer for selected evidence-backed knowledge that falls outside the
current bounded task and is not mature enough for a durable source. It is not a backlog, activity
log, defect register, execution history, or mandatory context source.

See the [Documentation Index](documentation-index.md) for current authority and routing.

## Admission Rules

Add a finding only when every condition is true:

- Specific repository, runtime, owner-confirmed, or authoritative external evidence supports it.
- It is outside the current bounded task and cannot be resolved safely inside that task.
- It could materially affect later planning, implementation, review, architecture, engineering, or
  product decisions.
- No active plan, work item, issue, product specification, durable decision, engineering rule, or
  Project Memory entry already represents it accurately.
- Forgetting it would plausibly cause a repeated mistake, incorrect decision, or avoidable
  investigation.
- A likely owner or workstream and a concrete next action can be named.

If any condition is uncertain, do not add the finding. Report it in the current task handoff for
triage instead.

## Exclusions

Do not record:

- ordinary implementation history or a narrative of what happened;
- branch, commit, PR, test-count, duration, validation-output, or publication status;
- routine defects fixed within their owning task;
- active-plan, work-item, issue, or checklist content;
- speculative ideas without evidence, material impact, or plausible ownership;
- temporary debugging notes, experiments, logs, or raw investigation output;
- duplicated facts, decisions, specifications, engineering rules, or Project Memory;
- observations with no material future consequence or next action; or
- secrets, credentials, personal data, production data, or environment-specific values.

## Entry Format

Use one short heading and only these fields:

```md
### <Finding title>

- Status: open | deferred pending named evidence or decision
- Evidence: <specific repository paths, runtime evidence, owner confirmation, or authoritative source>
- Impact: <material future consequence if forgotten>
- Likely owner: <role or workstream>
- Next action: <bounded investigation, decision, or implementation entry condition>
- Promotion target: <durable destination if the finding matures>
```

Evidence must be precise enough for another person or agent to revalidate. Do not copy logs or
large report sections into an entry.

## Promotion and Disposition

- Confirmed current project facts belong in the relevant maintained product or architecture document.
- Confirmed rationale belongs with the relevant product or architecture decision.
- Complete business rules belong in the relevant product specification.
- Normative repository rules that future work must follow belong in `docs/engineering/`.
- Validated project-specific lessons that remain useful but are not mandatory engineering rules or
  cross-project guidance belong with the relevant engineering document.
- A possible Foundation Kit lesson remains project-local until a separate generalization review,
  explicit user confirmation, and approved Foundation Kit plan authorize promotion.

Remove a finding once it is promoted, represented accurately elsewhere, superseded, resolved, or no
longer material. For a promoted finding, record its destination in the promoting commit or PR. Do
not retain a permanent execution or disposition history in this file.

## Workflow Boundary

This file is optional and must not be added to the Project Memory Context Gate, scanned for
unrelated tasks, or treated as an automatic promotion queue. A task may add, change, remove, or
promote a finding only when that documentation mutation is explicitly authorized. Otherwise the
task may report a candidate for later triage without changing this file.

## Open Entries

None.
