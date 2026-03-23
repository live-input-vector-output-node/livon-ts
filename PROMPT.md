<!-- @agent.entry -->
<!-- @agent.load: PROMPTS.md -->
<!-- @agent.load: website/docs/core/governance.md -->
<!-- @agent.load: website/docs/ai/root-gate.md -->

# LIVON - Root Prompt

Canonical documentation and rule sources live in Docusaurus.

Primary docs entrypoint:

- `/docs`
- file source: `website/docs/index.md`

Governance and engineering rule pages:

- `/docs/core/governance`
- `/docs/core/coding-style-guide`
- `/docs/core/definition-of-done`
- `/docs/core/project-context`
- `/docs/core/change-history`
- `/docs/core/testing-and-quality` (including executable documentation + branch-complete test requirements)

Testing policy note:

- For test creation/review tasks, load `/docs/core/testing-and-quality` as mandatory guidance.

Technical pages:

- `/docs/technical/runtime-design`
- `/docs/technical/architecture`
- `/docs/technical/event-flow`
- `/docs/technical/roadmap`

AI control pages:

- `/docs/ai`
- `/docs/ai/root-gate`
- `/docs/ai/specializations`
- `/docs/ai/context-routing`
- `/docs/ai/active-rules-and-gates`
- `/docs/ai/tool-mapping`

Rule highlights:

- Repository-wide recurring rules are centralized in `/docs/ai/root-gate`.
- Scope-specific deviations are centralized in `/docs/ai/specializations`.
- Repository workflow orchestration is Turborepo-only with no exceptions: workflows are invoked via root scripts (`pnpm run <task>`), never via direct `pnpm turbo run ...` or manual orchestration scripts/commands; workflow tasks are declared in `turbo.json`; package scripts remain atomic and non-orchestrating.
- Avoid TypeScript `as` assertions in repository code; design type contracts so casts are not required.
- Repository docs/examples use the Todo domain as the default use case so examples stay consistent across packages.
- Repository tests should use the Todo domain as the default use case when feasible so test language stays aligned with docs.
- Default delivery flow is `DX -> TDD -> implementation`: agree API/DX first, cover the full agreed DX with tests second, then iterate implementation until all tests are green.
- Related-library chip rows in docs and overviews must use linked code chips: internal `@livon/*` packages link to their package docs page, and external libraries link to their npm package page.
- For git merge/rebase conflicts, follow the root-gate repository policy: `newest version wins` by default, which means keeping the newest compatible version and aligning related files to it unless higher-priority instructions or explicit correctness/security/build constraints require otherwise.
- For root quality-gate and verification commands, prefer concise success output and focused failure output: surface OK/summaries when checks pass, and only the failed packages/files/error locations when checks fail unless explicit verbose debugging is requested.
- For implementation work, decide the owning layer first (`runtime`, `schema`, `transport`, `client`, `sync`, framework adapter) and implement logic in that boundary.
- Keep implementation and documentation synchronized in both directions: implementation changes require docs updates, and rule/behavior docs changes require matching implementation updates.

This file is an agent entrypoint only.
