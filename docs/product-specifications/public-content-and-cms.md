# Public Content and CMS

## Purpose

This specification defines the bounded public-content and content-management boundary for the
Badminton Club App. Administrators can maintain club-specific public information and editable
system communication that may change without requiring a code change or deployment.

The product serves one small badminton club. Its CMS uses explicit, task-oriented content
structures; it is not a generic page builder, media platform, document library, or editorial
workflow.

## Shared Product Rules

### Ownership

A shared administration area does not transfer business ownership. Homepage, Club Information,
Contact, Taster Session public information, Membership public information, Recruitment, Public Documents,
Activities, Team introduction, and Email Templates retain separate owners and persistence
boundaries.

All administrators may edit the approved CMS content. The product has no specialized content-editor
roles.

Location, Taster Session requests, Guest Play, Membership Application and Lifecycle, Team and
Competition, email delivery, and other capabilities continue to own their facts, policies,
lifecycle, and system contracts. CMS administration may edit only their approved public wording.

### Publication

Saving normally publishes or activates content immediately. Persistence success and public-cache
refresh are separate outcomes: a refresh failure must not be reported as complete publication or
cause a successful persistence command to be replayed.

Publication targets follow the owner whose current facts changed. Contact and Location publication
refresh every current public consumer, including Homepage and Recruitment, while Recruitment
publication refreshes its own localized destination. This is a bounded owner-to-consumer mapping,
not a generic dependency graph.

A dependency failure or a missing or invalid required content aggregate is unavailable, not a
successful empty public projection. An intentional empty list or omitted optional field remains a
valid result and must not be presented as dependency failure.

The product has no draft, editorial preview, approval, scheduled-publication, content-version,
rollback-history, specialist-editor, locking, or concurrent-edit workflow.

### Localization

Public club content supports German, English, and Chinese. German is the canonical language and
fallback: a requested non-empty translation is used first, followed by the non-empty German value.
Required localized fields require German content. Missing English or Chinese content may be shown
as incomplete in administration without blocking every save. An optional field that is empty in
all languages renders no CMS text.

Fixed UI and navigation labels, validation and error messages, role and status names, business-rule
terminology, and fixed action labels remain code- or i18n-owned.

## Content Owners

### Homepage Content

Homepage Content owns only explicitly approved homepage copy:

- the main homepage message;
- the Visit Us or public training introduction; and
- the Contact-section introduction.

It does not duplicate canonical club identity, Contact details, Taster Session or Membership action
summaries, fixed labels, routes, layout, or capability rules.

### Announcements

Announcements own the bounded `Latest Updates` section on the public Homepage. They are short
current club updates, not stable club-description content or a separate public news page.

Each Announcement has required German title and body content, optional English and Chinese
translations with German fallback, a display date, a manual visible or hidden state,
administrator-controlled order, and one lightweight visual type. It may include one optional HTTP
or HTTPS external link. The link uses fixed localized interface wording rather than becoming
administrator-managed link-label or link-catalog content.

Hidden Announcements remain available to administrators and may be shown again. Administrators may
explicitly delete an Announcement that is no longer worth retaining. Display date does not schedule,
expire, hide, or archive a record.

Announcements do not own images, files, embedded media, multiple links, expiry, scheduled
publication, archive or version history, public search, categories with workflow meaning,
notifications, social-feed behavior, or article/editorial behavior. Team, Match, Competition,
Taster Session, Membership, and other capability facts remain with their existing owners even when
an Announcement briefly reports or links to them.

### Club Information

Club Information is the canonical owner of:

- the official German, English, and Chinese club names;
- the short name;
- the founding year; and
- the localized club introduction.

Public surfaces may consume these facts instead of maintaining parallel copies. Contact channels,
logos, brand colors, logo variants, and theme configuration are outside this owner.

### Contact

Contact represents communication routes: the club matter and the channel through which someone
can contact the responsible club contact. It does not own or initiate Taster Session or Membership
business workflows.

Contact is a small ordered list, normally two to four records. Each record has an editable category,
localized title, localized short description, email address, active or hidden state, and display
order. It may also have one owner-scoped QR image with localized explanation and one HTTP or HTTPS
external link with localized label. Categories are administrator-maintained data, not a fixed
product enum.

The canonical initial public list contains, in order:

| Order | Category | Email | German title | English title | Chinese title |
| --- | --- | --- | --- | --- | --- |
| 0 | `general` | `info@club.invalid` | Allgemeine Anfragen | General Inquiries | 一般咨询 |
| 1 | `membership-and-taster` | `mitgliedschaft@club.invalid` | Mitgliedschaft und Schnuppertraining | Membership and Taster Sessions | 会员与新人体验活动 |

Its localized descriptions are:

| Category | Language | Description |
| --- | --- | --- |
| `general` | German | Für allgemeine Fragen zum Verein, zu unseren Angeboten und zum Vereinsleben. |
| `general` | English | For general questions about the club, its activities, and club life. |
| `general` | Chinese | 如有关于俱乐部、活动安排或俱乐部生活的一般问题，请联系我们。 |
| `membership-and-taster` | German | Für Fragen zur Mitgliedschaft, zur Aufnahme in den Verein oder zum Schnuppertraining. |
| `membership-and-taster` | English | For questions about membership, the admission process, or Taster Sessions. |
| `membership-and-taster` | Chinese | 如有关于会员、入会流程或新人体验活动的问题，请联系我们。 |

These records begin without a QR image or external link. Their categories, localized wording,
visibility, and order remain editable. QR replacement, removal, and Contact deletion must not
leave an unowned file or broken public reference.

### Taster Session Public Information

Taster Session public information owns exactly these localized fields:

- required `homepageSummary`;
- required `introduction`;
- optional `preparation`;
- optional `participationGuidance`; and
- optional `followUpGuidance`.

The detailed information appears before the existing request form. It may explain intended
participants, preparation, current fee or visit guidance, expected response, final confirmation,
and cancellation or rescheduling guidance. It does not own venue or time facts, request fields,
preference policy, booking or capacity, outcomes, archive behavior, or email delivery.

### Membership Public Information

Membership public information owns exactly these localized fields:

- required `homepageSummary`;
- required `introduction`;
- required `membershipTypes`;
- required `membershipPath`;
- optional `applicationPreparation`; and
- optional `studentProof`.

The public page consumes `Settings.membershipOpen` read-only as the sole intake-availability fact
and shows one fixed localized open or closed status. Both states retain the general information,
Public Documents, Contact route, and Taster Session route. Neither state exposes the controlled
formal Membership Application entry or grants application access.

Fees and legal rules remain authoritative in the approved documents. CMS wording may summarize
them but is not a parallel rule owner.

### Recruitment Public Information

Recruitment owns one club-wide `open` or `paused` state, one nullable reference to an existing
Contact entry, and exactly these required localized fields:

- `introduction` for the club-wide target audience;
- `requirements` for recruitment-specific player guidance; and
- `tryoutGuidance` for the human-coordinated process.

Opening Recruitment requires an explicitly selected active Contact entry. Contact remains
authoritative for its email, localized wording, QR image, external link, visibility, and lifecycle;
Recruitment stores only the reference. A later Contact hide or deletion remains valid and causes
the public Recruitment page to omit its tryout action and show a Contact-unavailable state without
falling back to another entry. Paused Recruitment may retain or omit the reference.

The localized `/{lang}/recruitment` route is the canonical direct and externally shareable URL.
Shareability means that the stable public URL can be posted elsewhere and the localized page is
understandable when opened directly; Recruitment does not own page-local sharing controls,
social-platform integrations, or dedicated social-preview image generation.
It remains available while paused, but paused state removes the tryout Contact action and
action-oriented process. The non-localized `/recruitment` path is compatibility input to normal
locale negotiation, not a second page or content owner. Homepage Join Us and Teams link to the
canonical destination with fixed localized discovery copy; Recruitment does not gain a separate
top-level Header item.

The public page composes current public Team facts and active Location/recurring-time facts from
their existing owners. Its light overview links to the Teams page for Team detail and summarizes
each Location by name and distinct active weekdays. Street addresses and exact recurring times
remain on Homepage `VisitUs`, linked from Recruitment. Training days are informational context and
must not be labelled as confirmed team-tryout appointments or filtered by Guest Play or Taster
Session restrictions.
The Team public projection orders teams deterministically by the existing Team-owned `teamId`;
Recruitment does not define a second order or Team description. The open-state Contact presentation
uses only channels supplied by the explicitly selected Contact and does not surface Contact's
generic administrative title or description as Recruitment page copy.
Competitive-team tryout coordination remains distinct from the general Taster Session request
workflow.

Fixed title, state, section, action, discovery, search, process, and atmospheric closing wording
remains code- or i18n-owned. Open state exposes the selected Contact action and process without a
separate open-status card; paused state keeps the overview and shows a paused notice but omits the
Contact action and process. The closing remains a general Recruitment sentiment and has no Taster
Session CTA. Recruitment has no editable image field, per-locale media, dedicated social-preview
machinery, per-Team recruitment content/state, request form, status lifecycle, waitlist, capacity,
booking, or scheduling owner.

### Public Documents

Public Documents owns one small administrator-managed collection with no arbitrary document-count
limit. Each document has one current PDF reference, localized display name, document or version
date, visible or hidden state, and a stable administrator-controlled relative position. New
documents append without reordering the existing collection, and hidden documents keep their
position when shown again.

Only visible documents with a usable file reference appear publicly on the Homepage, in the
owner-provided order. Hiding is reversible publication control, removing the current PDF is a
file-level action, and permanent document deletion is a distinct explicit action. PDF creation,
replacement, removal, and deletion must not leave a broken link or weaken positive file ownership,
replacement compensation, or cleanup-result reporting. This boundary does not add pagination,
search, folders, tags, categories, archive/history, a dedicated Documents page, or a general
document library.

### Team Introduction

Public Content and CMS owns the enabled state and localized public Team page title and general
introduction; the current Settings singleton is only their storage aggregate. The Team capability
continues to own Team, Player, roster, Match, ranking, and Competition facts. The CMS does not
duplicate them.

### Activities and Media

Activities remain structured localized content with deterministic German fallback, truthful
publication, translation-completeness feedback, localized video description, and owner-scoped
media lifecycle. Activity files must be validated, positively attributed to their owner, and
cleaned up on replacement or deletion without creating a shared asset catalog.

Activities also owns one module-level public availability state stored in the shared Settings
aggregate. Missing state is disabled, and initialization must not overwrite a later administrator
choice. This capability state is independent of each Activity record's `isVisible` value:
disabling Activities preserves every record, translation, media reference, order, and visibility
choice, while administrators retain the complete Activity management workflow.

When disabled, Activities is omitted from public discovery and the localized Activities route uses
not-found semantics. When enabled, the route and discovery destination remain available even when
no Activity is individually visible; only `isVisible` records appear publicly. A dependency
failure remains unavailable rather than being represented as disabled or as a valid empty list.
Changing availability uses the existing `activities` publication owner to refresh the direct route
and every current shared-discovery consumer. Navigation wording and structure remain code- and
i18n-owned rather than administrator-authored content.

### Email Templates

Administrators may edit localized email subjects and bodies. Each consuming capability retains
system ownership of template identity, supported locales, required variables, delivery meaning,
send conditions, retry behavior, and catalog status. Save, preview, and delivery must enforce the
same capability-owned contract.

A template without a verified current sender remains visible as unconsumed and preserves its
persisted active or inactive state. Absence of a repository call site alone does not establish
obsolescence. Consuming, deactivating, retiring, or deleting such a template requires later
capability-owner confirmation.

## Homepage Actions

The homepage contains a code-owned action section after Visit Us and before Contact. Its fixed
localized section title is `Mitmachen`, `Join Us`, or `加入我们`.

- The Taster Session action links to the public request workflow.
- The Membership action links to the information-only Membership page and never implies
  unrestricted application or account creation.
- The Recruitment action links to the localized canonical Recruitment page with fixed neutral
  discovery wording and does not duplicate maintained Recruitment copy on the Homepage.

The Taster Session and Membership card summaries are projections of their corresponding
`homepageSummary` fields. The Recruitment card summary is fixed i18n-owned discovery wording.
Layout, routes, titles, and action labels remain code- or i18n-owned; the homepage stores no
duplicate summaries and the section is not configurable content.

The fixed i18n-owned labels are:

| Element | German | English | Chinese |
| --- | --- | --- | --- |
| Section title | Mitmachen | Join Us | 加入我们 |
| Taster card title | Schnuppertraining | Taster Session | 新人体验活动 |
| Taster action | Schnuppertraining anfragen | Request a Taster Session | 申请新人体验活动 |
| Membership card title | Mitglied werden | Become a Member | 成为会员 |
| Membership action | Mehr zur Mitgliedschaft | Membership Information | 了解会员信息 |
| Recruitment card title | In einer Mannschaft spielen | Join a Competitive Team | 加入竞技球队 |
| Recruitment action | Zur Mannschaftssuche | Team Recruitment | 查看球队招募 |

## Content Outside CMS

Unless a later confirmed product decision establishes a real administrative need, CMS does not
own:

- navigation, standard section, form, validation, error, role, status, gender, or Competition
  position labels;
- authorization, lifecycle, request, Membership, Match, Availability, Lineup, ranking, result,
  delivery, or retry rules;
- Location and recurring weekly play-time facts;
- arbitrary pages, blocks, widgets, sections, layout, theme, or visual-design configuration; or
- generic media, document, notification, contact-channel, or asset-management capabilities.

## Deferred Product Decisions

The following remain outside the current bounded delivery and require a later real usage scenario
and Product Owner decision:

- Team-specific recruitment state, descriptions, criteria, contacts, or photos;
- Activity date, category, cover image, registration link, or richer gallery behavior;
- custom membership-intake closure explanations beyond the fixed status and approved Membership
  content; and
- consuming, deactivating, retiring, or deleting an unconsumed email template.

## Documentation Boundary

This document owns the maintained product rules for bounded public content and CMS. The
[Capability Overview](../capability-overview.md) owns capability navigation and maturity. Detailed
Taster Session request, Membership, Guest Play, and Competition behavior remains with its own
maintained product or architecture owner. Current implementation facts belong to Project Memory
and repository evidence.
