---
title: Governance and Rule Sources
sidebar_position: 6
---

This page defines the documentation single source of truth policy for this repository.
Use it as the reference when deciding where canonical rules and process docs belong.

## Single source of truth

Canonical project documentation lives in Docusaurus under `/docs`.

Root markdown files outside `website/docs` are entrypoints and compatibility stubs only.

## Rule source map

1. [What Is LIVON and Why](what-is-livon)
2. [Getting Started](getting-started)
3. [Contributing](contributing)
4. [Coding Style Guide](coding-style-guide)
5. [Definition of Done](definition-of-done)
6. [Testing and Quality](testing-and-quality)
7. [Project Context](project-context)
8. [Change History](change-history)
9. [Architecture](/docs/technical/architecture)
10. [Runtime Design](/docs/technical/runtime-design)
11. [Event Flow](/docs/technical/event-flow)
12. [Roadmap](/docs/technical/roadmap)

## Prompt entrypoint policy

- `PROMPT.md` is an entrypoint file that links to these docs.
- `PROMPTS.md` is the prompt index entrypoint that links to these docs.
- Package prompt files must link to the relevant Docusaurus pages for package scope.

## Migration policy

When adding or updating repository documentation:

1. Update the Docusaurus page first.
2. Keep root/package README-style files as short redirects only.
3. Avoid duplicate rule text across non-doc files.

## Tooling governance policy

Tooling policy is defined in [Contributing](contributing).

- Prefer default configs and standard tool commands over custom wrappers.
- Use Turborepo (`turbo.json`) as the orchestration layer for monorepo tasks.
