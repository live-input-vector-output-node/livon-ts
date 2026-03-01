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
| `root-turbo-orchestration` | Root package scripts must orchestrate through `turbo run ...`. | root script policy check |
| `root-no-hardcoded-filter` | Root scripts must not hardcode `--filter`; filters are caller-supplied. | root script policy check |
| `workspace-tool-packages` | Shared automation lives in dedicated workspace packages and runs via Turbo tasks. | governance + workspace structure checks |
| `dual-track-rule-publication` | New or changed rules must be documented for humans and agents. | gate review + docs workflow |
| `docs-implementation-sync` | Keep documentation and implementation synchronized in both directions: implementation changes require docs updates, and docs changes that alter contracts/behavior require matching implementation updates. | gate review + definition-of-done + code review |
| `docs-canonical-source` | Documentation content is edited in `website/docs` only; other docs artifacts are generated/derived from canonical docs. | governance + docs workflows + generated artifact checks |
| `pre-push-full-gates` | Before every push, run `pnpm qg` (full repository gates: `check:readmes`, `check:policies`, `lint`, `typecheck`, `test`, `build`). | contributing workflow + CI parity |
| `lint-warning-no-regressions` | Lint warning counts are budgeted per package and must not increase without explicitly updating the central budget config. | lint scripts + `configs/quality/lint-warning-budgets.json` + policy checks |
| `package-readmes-from-docs` | Package README files are generated from `website/docs/packages` and must stay in sync. | `turbo run gen:readmes` + `turbo run check:readmes` |
| `aggregated-policy-reporting` | Policy checks run as a set and produce one aggregated report. | `tools/policies/check.ts` |
| `centralize-shared-rules` | Shared recurring rules are centralized in root gate; scoped deviations are registered in specializations. | root-gate + specialization checks |

## Usage

1. When authoring or updating rules, update `configs/ai/root-gate.json` and this page first.
2. Other docs and agent files should reference this page for recurring repository-wide rules.
3. Register scope-specific deviations in [Specializations](specializations).
4. Keep task-specific guidance local, but keep recurring global rules centralized here.
