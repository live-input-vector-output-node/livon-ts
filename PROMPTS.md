<!-- @agent.entry -->
<!-- @agent.load: PROMPT.md -->
<!-- @agent.load: website/docs/index.md -->
<!-- @agent.load: website/docs/core/governance.md -->
<!-- @agent.load: website/docs/core/coding-style-guide.md -->
<!-- @agent.load: website/docs/core/definition-of-done.md -->
<!-- @agent.load: website/docs/core/project-context.md -->
<!-- @agent.load: website/docs/core/change-history.md -->
<!-- @agent.load: website/docs/core/contributing.md -->
<!-- @agent.load: website/docs/core/testing-and-quality.md -->
<!-- @agent.load: website/docs/core/generators.md -->
<!-- @agent.load: website/docs/technical/runtime-design.md -->
<!-- @agent.load: website/docs/technical/architecture.mdx -->
<!-- @agent.load: website/docs/technical/event-flow.mdx -->
<!-- @agent.load: website/docs/technical/roadmap.mdx -->
<!-- @agent.load: website/docs/packages/index.md -->
<!-- @agent.load: packages/client/PROMPT.md -->
<!-- @agent.load: packages/schema/PROMPT.md -->

# Prompt Index

This file lists prompt entrypoints and canonical Docusaurus rule/documentation pages.

## Prompt entrypoints

- `PROMPT.md` – root prompt entrypoint
- `PROMPTS.md` – prompt inventory entrypoint
- `packages/client/PROMPT.md` – client package prompt entrypoint
- `packages/schema/PROMPT.md` – schema package prompt entrypoint

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
7. package-specific prompt entrypoints
