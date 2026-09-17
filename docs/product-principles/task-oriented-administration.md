# Task-Oriented Administration

## Purpose

This document defines the product principles for designing administrative interfaces.

It complements individual feature specifications by describing how administrative workflows should be designed independently of specific business domains.

These principles should guide future UI design, API evolution, feature prioritisation, and technical evaluation.

They are intentionally implementation-independent.

---

## Core Principle

Administrative interfaces should be designed around the administrator's primary tasks rather than around exposing complete entity data.

The design process should begin with understanding:

- what administrators most frequently need to accomplish;
- what information is required to complete those tasks;
- what interactions minimise effort and cognitive load.

The interface should then expose only the information and actions necessary for those workflows.

---

## Workflow Before Layout

The expected design order is:

1. Identify the primary administrative workflows.
2. Identify the most frequent user tasks.
3. Determine the minimum information required for each task.
4. Design the required interactions.
5. Build the appropriate UI for the target device.

The interface should never begin by reproducing an existing desktop layout on a smaller screen.

---

## Mobile and Desktop

Mobile and desktop are expected to support different administrative scenarios.

They should not be treated as identical interfaces with different screen sizes.

Desktop interfaces are generally better suited for:

- high-density information;
- broad comparisons;
- complex filtering;
- large batch operations;
- configuration-heavy workflows;
- long administrative sessions.

Mobile interfaces are generally better suited for:

- quick administration;
- searching;
- viewing essential information;
- changing individual status;
- selected batch actions;
- handling urgent or pending tasks.

Different information density does not imply different business logic.

Both interfaces should operate on the same underlying business model.

---

## Information Projection

Administrative interfaces should expose the information required to complete the current task.

They should not attempt to display every available field of an entity.

For example:

Instead of asking:

> Which member fields should be shown?

Design should first ask:

> What does the administrator need to accomplish?

The required information should then be projected from the underlying business model.

This principle applies equally to:

- member management;
- activities;
- training sessions;
- matches;
- teams;
- future administrative features.

---

## Progressive Disclosure

Frequently used information should be immediately visible.

Secondary information should appear only when required.

Typical techniques include:

- detail views;
- expandable sections;
- contextual actions;
- progressive disclosure.

This allows mobile interfaces to remain efficient without sacrificing functionality.

---

## API and Data Considerations

Differences between mobile and desktop interfaces should initially be treated as presentation concerns.

Later analysis may determine whether:

- API projections;
- response contracts;
- specialised endpoints;
- view models;

should also evolve.

Different interface layouts do not automatically require different database structures or duplicated business models.

---

## Current Assessment

The current mobile member-management interface provides an acceptable baseline.

Its compact presentation of member identity, membership status, and primary actions aligns well with task-oriented administration.

Future refinement should focus on validating administrator workflows rather than increasing visual similarity with the desktop interface.

---

## Product Principle

Task-oriented administration takes precedence over entity-oriented presentation.

Interfaces should optimise task completion rather than field visibility.

Whenever a design decision is required, the preferred question is:

> What task is the administrator trying to complete?

rather than:

> Which fields belong to this entity?

---

## Use in Later Analysis

These principles should be applied when evaluating:

- administrative workflows;
- responsive interface design;
- information density;
- API projections;
- frontend architecture;
- future UI refactoring.

These principles describe product behaviour only.

They do not prescribe implementation architecture or database design.