---
title: Root Gate
sidebar_position: 2
---

This page is the canonical set of recurring repository-wide rules for both humans and agents.

Machine-readable source:

- `configs/ai/root-gate.json`

Use this page as the primary reference instead of repeating the same rule text across multiple files.

## Rule set

| Rule ID | Rule | Primary enforcement |
| --- | --- | --- |
| `typescript-first` | Prefer TypeScript over JavaScript when technically feasible. | coding style + review gates |
| `arrow-functions-only` | Use arrow functions as the default for implementations and exported callable APIs; avoid the `function` keyword, including overload declarations (use callable interfaces plus `const` arrow assignments). | coding style + review gates |
| `destructured-config-defaults` | When functions accept config objects, destructure parameters directly and set defaults with ES6 parameter defaults; keep property names aligned and avoid `config.*` access. | coding style + review gates |
| `no-as-type-assertions` | Do not use TypeScript `as` type assertions in repository code; design type contracts (generics, overloads, discriminated unions, type guards) so casts are not required. | coding style + review gates |
| `stable-reference-rebuild-policy` | Keep object/array references stable by default: only rebuild when relevant values change, compare before building in hot paths, and require explicit invalidation (or bounded limits) for caches. | architecture + performance review + code review |
| `pathfinder-clean-code-refactoring` | Apply the Pathfinder rule on every implementation change: if friction/duplication/mixed concerns are discovered in touched scope, refactor immediately so code gets cleaner with each change; if files become too large or semantically mixed, split by semantic slices/domains (for example builder/helper/utils/context/API surface) and expose each split through local barrel files instead of one monolithic file. | architecture + code review + maintainability checks |
| `test-setup-deduplication` | Before adding new tests, inspect existing tests for similar setup and extract shared setup into `beforeEach` blocks or reusable test utilities to avoid duplicated `entity/source/action/stream` scaffolding. | testing style + review gates |
| `test-structure-and-parametrization` | Tests must be grouped with `describe` blocks; shared group test data should be initialized via `beforeEach` or reusable test utilities when feasible; and same-behavior/different-data cases should be consolidated with `it.each`. | testing style + review gates |
| `modular-file-structure` | Keep utilities in scoped `utils` folders with one utility per file and `index` barrel exports; split main functionality into focused files and expose public boundaries through `package.json` exports plus index barrels. | architecture + coding style + review gates |
| `reuse-existing-utils-first` | Before implementing new logic, first check existing utilities/modules for reusable equivalents, including across package boundaries. If similar logic exists in another package, prefer consolidating it into `@livon/utils` and introducing that dependency where needed. When two or more candidates exist, prefer the most performant and cleanest implementation, or merge them into one shared configurable solution that combines the best traits. | architecture + coding style + maintainability checks |
| `no-wrapper-passthrough-helpers` | Wrapper passthrough helpers are forbidden by default: if a helper only forwards to another function without adding behavior or domain constraints, call the shared utility directly. | architecture + coding style + maintainability checks |
| `refactor-existing-rule-violations-when-feasible` | If existing code in touched scope is found to violate active repository rules, refactor it in the same change when feasible and safe, without unnecessary scope expansion. | architecture + coding style + maintainability checks |
| `scope-discipline-minimal-expansion` | Enforce strict scope discipline: keep edits within requested/touched scope plus direct correctness/build/test/policy dependencies; expand scope only when explicitly required. | governance + code review + maintainability checks |
| `package-exports-entry-contract` | Every public API entrypoint must be declared in `package.json` `exports` with `types` (`.d.ts`), `import` (`.js`), and `require` (`.cjs`) mappings to `dist`, for both root and deep import paths. | package export policy check + review gates |
| `core-framework-separation` | When changing framework adapters, evaluate first whether logic is framework-agnostic; shared runtime/state/sync behavior belongs in `@livon/sync` core, while framework packages keep adapter integration only. | architecture review + `core-framework-separation` policy check |
| `module-responsibility-boundaries` | For every implementation change, enforce package responsibilities at the correct layer: runtime/core/schema/transport/framework modules must not absorb each other's concerns, and cross-layer coupling must stay within defined architecture boundaries. | architecture review + `package-responsibility-boundaries` policy check |
| `root-turbo-orchestration` | Repository workflow orchestration is Turborepo-only with no exceptions: workflows must be invoked through root scripts (`pnpm run <task>`); direct `pnpm turbo run ...` and manual orchestration scripts/commands are forbidden; workflow tasks must be declared in `turbo.json`; package scripts stay atomic and non-orchestrating. | root script policy check |
| `root-no-hardcoded-filter` | Root scripts must not hardcode `--filter`; filters are caller-supplied. | root script policy check |
| `workspace-tool-packages` | Shared automation lives in dedicated workspace packages and runs via Turbo tasks. | governance + workspace structure checks |
| `dual-track-rule-publication` | New or changed rules must be documented for humans and agents. | gate review + docs workflow |
| `docs-implementation-sync` | Keep documentation and implementation synchronized in both directions: implementation changes require docs updates, and docs changes that alter contracts/behavior require matching implementation updates. | gate review + definition-of-done + code review |
| `docs-canonical-source` | Documentation content is edited in `website/docs` only; other docs artifacts are generated/derived from canonical docs. | governance + docs workflows + generated artifact checks |
| `docs-related-library-links` | Related-library chip rows in docs and overview pages must use linked code chips: internal `@livon/*` packages link to their package docs page, and external libraries link to their npm package page. | docs-related-library-links policy check + links check |
| `docs-example-domain-todo` | Repository examples should use the Todo domain as the default use case to keep docs and API examples consistent across packages. | docs review + package docs maintenance |
| `docs-example-destructuring` | Documentation examples should destructure hook return values with semantic names, but keep unit instances as objects and call unit methods via dot access (for example `unit.run(...)`, `unit.refetch(...)`). | docs review + package docs maintenance |
| `tests-example-domain-todo` | Repository tests should use the Todo domain as the default use case when feasible so tests and docs stay aligned in language and intent. | test review + package test maintenance |
| `dx-tdd-implementation-flow` | Default delivery flow is `DX -> TDD -> implementation`: agree API/DX first, cover the full agreed DX in tests second, then implement until all tests are green. | planning + test review + implementation review |
| `pre-push-full-gates` | Before every push, run `pnpm qg` (full repository gates: `check:readmes`, `check:policies`, `lint`, `typecheck`, `test`, `bench:gate`, `build`). | contributing workflow + CI parity |
| `workflow-action-version-consistency` | GitHub Actions referenced across repository workflows must use one consistent version per action; updates should align all workflows to the newest compatible version. | workflow policy check + contributing workflow |
| `git-conflicts-newest-wins` | When resolving git merge or rebase conflicts, default to `newest version wins`: keep the newest compatible version and align related files to it unless a higher-priority instruction or explicit correctness/security/build constraint requires otherwise. | code review + gate review |
| `concise-check-output` | Root quality-gate and verification commands must prefer concise success output and focused failure output: show task/package summaries when checks pass, and print detailed logs only for failed checks or explicitly requested verbose debugging. | root scripts + CI workflows + gate review |
| `lint-warning-no-regressions` | Lint warning counts are budgeted per package and must not increase without explicitly updating the central budget config. | lint scripts + `configs/quality/lint-warning-budgets.json` + policy checks |
| `package-readmes-from-docs` | Package README files are generated from `website/docs/packages` and must stay in sync. | `pnpm run gen:readmes` + `pnpm run check:readmes` |
| `aggregated-policy-reporting` | Policy checks run as a set and produce one aggregated report. | `tools/policies/check.ts` |
| `hierarchical-instruction-inheritance` | Scoped instruction files must inherit through the nearest parent AGENTS chain so root + scope rules compose deterministically. | AGENTS hierarchy policy check + context routing |
| `centralize-shared-rules` | Shared recurring rules are centralized in root gate; scoped deviations are registered in specializations. | root-gate + specialization checks |

## Usage

1. When authoring or updating rules, update `configs/ai/root-gate.json` and this page first.
2. Other docs and agent files should reference this page for recurring repository-wide rules.
3. Register scope-specific deviations in [Specializations](specializations).
4. Keep task-specific guidance local, but keep recurring global rules centralized here.
