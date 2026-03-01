---
title: Context Routing
sidebar_position: 4
---

Deterministic context routing avoids full-load prompts while preserving all canonical rule sources.

Machine-readable routing source:

- `configs/ai/context-routing.json`

## Load policy

Always load:

1. `PROMPT.md`
2. `PROMPTS.md`
3. [Root Gate](root-gate)
4. this page
5. [Active Rules and Gates](active-rules-and-gates)

Baseline load for unclear or cross-cutting tasks:

1. `/docs/core/governance`
2. `/docs/core/coding-style-guide`
3. `/docs/core/definition-of-done`

## Conditional routing table

| Trigger | Required context |
| --- | --- |
| `packages/schema/**` touched | `packages/schema/PROMPT.md`, `/docs/packages/schema`, `/docs/schema` |
| Schema APIs or parsing/type-safety changes | `/docs/schema/index`, `/docs/schema/schema-factory`, `/docs/schema/type-safety` |
| `packages/client/**` touched | `packages/client/PROMPT.md`, `/docs/packages/client`, `/docs/core/generators`, `/docs/core/schema-doc-and-generated-jsdoc` |
| Runtime, transport, hook lifecycle changes | `/docs/technical/runtime-design`, `/docs/technical/architecture`, `/docs/technical/event-flow`, `/docs/technical/roadmap` |
| Testing, mocks, branch behavior, quality review | `/docs/core/testing-and-quality` |
| Repo policy, contributor workflow, CI, scripts | `/docs/core/contributing`, `/docs/core/governance` |
| Package/folder-specific instruction work | `/docs/ai/specializations`, `configs/ai/specializations.json` |
| Product/repository context or historical rationale | `/docs/core/project-context`, `/docs/core/change-history` |
| Docs navigation/package catalog changes | `/docs/packages/index` |

## Fallback behavior

If routing is ambiguous:

1. start with baseline load,
2. extract active rules,
3. load one additional context source at a time until scope is unambiguous.

## Regression and enforcement

- Routing fixtures and load budgets are validated by `pnpm check:policies`.
- AI routing metrics can be inspected with `pnpm metrics:ai-control`.
- The policy runner prints an aggregated summary after all checks complete (no fail-fast at first issue).
