The key points are:

- Section header: ## ADDED Requirements (or MODIFIED/REMOVED)
- Requirement title: ### Requirement: Title
- Blank line between title and metadata
- Metadata: **Priority**: High and **Effort**: 1 hour (The colon must be outside the bold formatting for the metadata fields. So it should be **ID**: value not **ID:** value.)
- Description paragraph, must contain SHALL or MUST
- Acceptance Criteria (optional but recommended)
- Scenario blocks: #### Scenario: Description
- Scenario steps: Bullet points with - **GIVEN**, - **WHEN**, - **THEN**, - **AND**

# Example

## invalid format
### Requirement: Touched Fields Management for Auto-fill

**ID:** `MEM-APP-VAL-002`
**Priority:** High
**Effort:** 1 hour

## Valid format(colon Must be out of the **)
### Requirement: Touched Fields Management for Auto-fill

**ID**: `MEM-APP-VAL-002`
**Priority**: High
**Effort**: 1 hour