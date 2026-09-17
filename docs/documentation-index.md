# Documentation Index

This index is the routing map for project documentation. Start with the question you need to
answer, then follow the smallest relevant authority. It deliberately does not enumerate every
plan, execution log, research note, or archived artifact.

## Authority Labels

- **Current authority:** maintained product, project, architecture, engineering, or workflow truth.
- **Delivery artifact:** authority only for one explicitly identified task, phase, or execution run.
- **Supporting reference:** useful context or method that does not override current authority.
- **Historical evidence:** a dated snapshot retained for traceability and revalidation, including
  material available only in private source history (excluded from this snapshot); not current truth or an executable task list.
- **Provenance stub:** a retained path identifying historical material and its current replacement;
  it does not contain the former detailed evidence or own current behavior.

When sources conflict, first classify the question as product intent, current implementation,
durable decision, engineering rule, delivery state, or historical context. Historical and delivery
artifacts do not override current authority outside their stated scope.

## Route by Question

| Question | Read first | Authority | When to read or update |
| --- | --- | --- | --- |
| What is the product and who is it for? | [Project Overview](project-overview.md) | Current authority | Read for product identity and major workflows. Update when the stable product boundary changes. |
| What are the main capabilities, their relationships, and their maintained owners? | [Capability Overview](capability-overview.md) | Current authority | Start here for capability navigation and maturity. Follow the linked product or architecture owner for detailed rules. |
| What operational business changes must administrators be able to trace, and what does Audit own? | [Audit](product-specifications/audit.md) | Current authority | Read before changing Audit record/read mechanics, inspection scope, privacy boundaries, or retention. The changing capability still owns whether Audit is required and which business facts it records. |
| What content is CMS-managed, who owns it, and how do localization, publication, files, Contact, public documents, and homepage actions behave? | [Public Content and CMS](product-specifications/public-content-and-cms.md) | Current authority | Read before changing the bounded public-content or CMS ownership, publication, localization, or content-coverage boundary. |
| How does a visitor request a first club experience and how does an administrator follow up? | [Taster Session](product-specifications/taster-session.md) | Current authority | Read for non-binding preferences, duplicate rules, terminal outcomes, archive, and capability-owned email behavior. |
| How does a current member request permission to bring guests to a club play opportunity? | [Guest Play](product-specifications/guest-play.md) | Current authority | Read for authoritative opportunities, member eligibility, outcomes, archive, and truthful email-delivery behavior. |
| How is a canonical User established and invited for an approved applicant, administrator-established Member, External Player, or reviewed legacy import? | [Account Onboarding](product-specifications/account-onboarding.md) | Current authority | Read for shared identity, normalized-email, invitation, delivery, expiry, reissue, and entry-path behavior. |
| How does controlled Membership Application intake and review establish a Member? | [Controlled Membership Registration](product-specifications/registration.md) | Current authority | Read for applicant access, submission, administrator review, approval, and the boundary with shared onboarding. |
| How do administrators distinguish active participants from Members and export bounded Member or Team-roster data? | [Member Administration](product-specifications/member-administration.md) | Current authority | Read for cohort definitions, complete-cohort statistics, CSV boundaries, and ownership of Team roster facts. |
| What owns User, Membership, Player, eligibility, and lifecycle distinctions? | [Membership Domain Architecture](architecture/membership-domain-model.md) | Current authority | Read before changing Member–Player relationships, lifecycle ownership, access distinctions, or the Membership–Competition boundary. |
| What are the confirmed Team, Match, Availability, Lineup, ranking, result, History, and Competition access rules? | [Competition](product-specifications/competition.md) | Current authority | Read for Competition product behavior; follow its links for Membership-owned eligibility and onboarding. |
| What product behaviour or business rule is intended? | [Product principles](product-principles/) and [product specifications](product-specifications/) | Current authority | Read the relevant capability document. Update only after product intent is confirmed. |
| What is the durable domain or architecture model? | [Architecture documentation](architecture/) | Current authority | Read the relevant model before changing its ownership or invariants. Update after an accepted architecture change. |
| What repository engineering rule must future work follow? | [Engineering documentation](engineering/) | Current authority | Read for the affected engineering boundary. Update when a normative repository rule is accepted. |
| What do API startup, liveness, live readiness, and the explicit pilot/release preflight establish? | [Runtime Readiness](engineering/runtime-readiness.md) | Current authority | Read before changing startup gates, `/api/health`, `/api/ready`, runtime preflight, or the application/deployment readiness boundary. |
| What must be checked before deploying Taster Session shared-source and canonical request behavior in a non-resettable environment? | [Taster Session Deployment Readiness](engineering/taster-session-deployment-readiness.md) | Current authority | Verify exact legacy-to-shared slot policy mapping separately, then run the request-data, email-template, and index gates; stop on ambiguous source policy, legacy statuses, incompatible documents, normalized pending duplicates, or index conflicts. |
| What evidence-backed, out-of-scope finding could materially affect later work? | [Open Findings](open-findings.md) | Supporting reference | Read only when the active task explicitly needs relevant unresolved knowledge. Add or promote an entry only within authorized documentation scope. |
| What did earlier audits, testing, or foundational analysis observe? | The [historical and supporting evidence](#historical-and-supporting-evidence) locations below | Provenance stubs and historical evidence | Use the retained stubs to identify the material; consult private source history (excluded from this snapshot) for the detailed evidence. Reverify before reuse, never as default current-state context. |

## Historical and Supporting Evidence

The ordinary audit, testing, analysis, and planning paths below now contain only provenance
stubs. Their detailed snapshots belong to private source-project history, which is not included in this public repository.
These historical references are not prerequisites for development or validation. The stubs themselves
are navigation references, not the historical evidence they identify.

The local-only research and archive locations below remain separate supporting sources.

| Evidence class | Retained location | Role |
| --- | --- | --- |
| June 2026 repository audit, feature map, manual test guide, and tester feedback | `docs/00-repository-audit-report.md`, `docs/01-feature-status-map.md`, `docs/02-manual-test-guide-zh.md`, and `docs/manual-test-report-zh.md` | Provenance stubs; detailed implementation and testing snapshots are in private source history (excluded from this snapshot). |
| Foundational-analysis scope, dimensions, deliverables, evidence rules, and execution strategy | `docs/project-analysis-scope-and-decisions.md`, `docs/cross-cutting-analysis-dimensions.md`, `docs/project-analysis-deliverables.md`, `docs/project-analysis-evidence-index.md`, and `docs/analysis-execution-strategy.md` | Provenance stubs; detailed methodology and historical analysis-phase contracts are in private source history (excluded from this snapshot), not current execution authority. |
| Modernization and repair planning/delivery snapshot | [Modernization and Repair Provenance](active-modernization-and-repair-plan.md) | Provenance stub; the frozen planning/delivery record is in private source history (excluded from this snapshot) and owns no current task or next-step state. |
| Repair and refactoring decomposition | [Repair and Refactoring Provenance](repair-refactoring-planning-report.md) | Provenance stub; the detailed report is in private source history (excluded from this snapshot) and its work packages and sequencing are not active authority. |

The index classifies these materials; it does not make every item mandatory reading or certify the
accuracy of historical content.

## Delivery and Execution Artifacts

- A plan is authoritative only for the task that explicitly approved it.
- Work-item checklists define reviewable slices but do not become product, architecture, or project
  truth.
- Execution-state files preserve resumability; they may contain commits, validation results, and
  checkpoints that should not be copied into durable documentation.
- Handoffs and prompts carry bounded process context. They do not override Project Memory, product
  specifications, engineering rules, or current repository evidence.

## Maintenance Rule

Update this index only when a documentation class, authority route, or discovery rule changes. Do
not update it for each new plan, finding, research note, execution checkpoint, or archived file.
The document that owns a fact remains responsible for its content; other documents should link to
that owner instead of copying its taxonomy or details.
