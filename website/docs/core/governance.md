---
title: Governance and Rule Sources
sidebar_position: 6
---

This page defines the documentation single source of truth policy for this repository.
Use it as the reference when deciding where canonical rules and process docs belong.

## Single source of truth

Canonical project documentation lives in Docusaurus under `/docs`.
Canonical documentation content edits must happen in `website/docs/**`.

Derived documentation artifacts (for example `packages/*/README.md`) must be generated from canonical docs and must not be manually maintained as separate content sources.

## Rule source map

1. [Why Livon Exists](why-livon-exists)
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

## Rule publication contract

When adding or changing rules, document them in both tracks:

1. Human-facing canonical docs in Docusaurus (`/docs`).
2. Agent-facing entrypoints and routing (`PROMPT.md`, `PROMPTS.md`, `AGENTS.md`, package prompts/instructions).

A rule change is only complete when both tracks are updated.

Shared recurring rules must be centralized in `/docs/ai/root-gate`.
If a package/folder deviates, register the deviation in `/docs/ai/specializations` and its machine-readable config.

## Migration policy

When adding or updating repository documentation:

1. Update the Docusaurus page first.
2. Avoid duplicate rule text across non-doc files.

## Tooling governance policy

Tooling policy is defined in [Contributing](contributing).

- Prefer default configs and standard tool commands over custom wrappers.
- Use Turborepo (`turbo.json`) as the orchestration layer for monorepo tasks.
- Root `package.json` scripts must orchestrate via `turbo run ...`.
- Repository workflow commands must be executed via root script entrypoints (`pnpm run <task>`); direct `pnpm turbo run ...` and direct `pnpm -C <package>` workflow execution are not allowed.
- Manual orchestration scripts/commands are forbidden; if a new workflow command is introduced, it must be integrated as a Turbo task.
- Repository workflow tasks must be declared in `turbo.json` under `tasks`.
- Root scripts must not hardcode `--filter`; callers may pass filters when needed.
- Shared automation must live in dedicated workspace packages (for example `tools/*`) and run via Turbo tasks.
- Package README files under `packages/*/README.md` are generated artifacts sourced from `website/docs/packages/*.md`.
- README sync is executed via `tools/readmes` (`gen:readmes`, `check:readmes`) and is part of CI/publish enforcement.
- Lint warning budgets are centralized in `configs/quality/lint-warning-budgets.json` and enforced through package `lint` scripts + `check:policies`.
- Before every push, run `pnpm qg` (full repository gates: `check:readmes`, `check:policies`, `lint`, `typecheck`, `test`, `bench:gate`, `build`).
- For local development speed, `pnpm qg:changed` runs the same gate graph for affected scope only.
