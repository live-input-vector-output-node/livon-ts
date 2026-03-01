---
title: AI Control Plane
sidebar_position: 1
---

This section defines how agents load context and enforce rules in this repository.

Core principle:

- Canonical engineering and product rules stay in existing docs.
- AI control docs define routing, prioritization, and enforcement.
- No rule source duplication.

Use these pages as the control layer:

- [Root Gate](root-gate)
- [Specializations](specializations)
- [Context Routing](context-routing)
- [Active Rules and Gates](active-rules-and-gates)
- [Tool Mapping](tool-mapping)
- [Approach and Rationale](approach-and-rationale)

Machine-readable routing source:

- `configs/ai/context-routing.json`

Operational commands:

- `pnpm check:policies`
- `pnpm metrics:ai-control`

## Enforced rules

Recurring repository-wide rules are centralized in [Root Gate](root-gate).
Other AI docs should reference that page instead of repeating the same rule text.

## Naming convention

- Default Markdown filename pattern: lowercase-kebab-case.
- Keep tool-mandated filenames unchanged: `AGENTS.md`, `PROMPT.md`, `PROMPTS.md`, `SKILL.md`.
