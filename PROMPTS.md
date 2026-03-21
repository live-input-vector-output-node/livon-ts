<!-- @agent.entry -->
<!-- @agent.load: PROMPT.md -->
<!-- @agent.load: website/docs/ai/root-gate.md -->
<!-- @agent.load: website/docs/ai/specializations.md -->
<!-- @agent.load: website/docs/ai/context-routing.md -->

# Prompt Index

This file lists prompt entrypoints and canonical Docusaurus rule/documentation pages.

## Prompt entrypoints

- `PROMPT.md` – root prompt entrypoint
- `PROMPTS.md` – prompt inventory entrypoint
- `packages/client/PROMPT.md` – client package prompt entrypoint
- `packages/runtime/PROMPT.md` – runtime package prompt entrypoint
- `packages/schema/PROMPT.md` – schema package prompt entrypoint

## AI control entrypoints

- `website/docs/ai/index.md` – AI control-plane overview
- `website/docs/ai/root-gate.md` – centralized recurring repository-wide rules
- `website/docs/ai/specializations.md` – centralized scope-specific deviations
- `website/docs/ai/context-routing.md` – deterministic context routing policy
- `website/docs/ai/active-rules-and-gates.md` – active rule set + gate review contract
- `website/docs/ai/tool-mapping.md` – Codex/Copilot capability mapping
- `website/docs/ai/approach-and-rationale.md` – design rationale and official references
- `website/docs/ai/multi-agent-council.md` – role-based multi-agent collaboration contract

## Canonical documentation source

- Docusaurus docs (`/docs`) are the single source of truth.
- Start with `/docs/core/governance`.
- Load package docs based on touched paths.
- Use schema-specific docs when working in `packages/schema/*`:
  - `/docs/packages/schema`
  - `/docs/schema`

## Recommended load order

1. `PROMPT.md`
2. `/docs/core/governance`
3. `/docs/core/coding-style-guide`
4. `/docs/core/definition-of-done`
5. `/docs/core/testing-and-quality` (mandatory for test strategy and branch coverage rules)
6. `/docs/technical/runtime-design`
7. `/docs/technical/architecture`
8. package-specific prompt entrypoints
