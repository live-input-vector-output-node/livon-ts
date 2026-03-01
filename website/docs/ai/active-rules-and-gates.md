---
title: Active Rules and Gates
sidebar_position: 5
---

This page defines enforcement behavior. Context loading alone is not enforcement.

## Active Rule Set

Before implementation, produce an Active Rule Set with up to 12 bullets.

It must include:

1. architecture boundaries,
2. coding style constraints,
3. required validation/test commands for changed scope,
4. explicit conflict resolution (`higher priority rule wins`),
5. applicable recurring rules from [Root Gate](root-gate) by rule id,
6. applicable scope-specific deviations from [Specializations](specializations) by specialization id.

Priority order:

1. system/developer/user instructions,
2. package-level prompt/rules in scope,
3. core governance/coding/testing docs,
4. task-local instructions.

## Scope Lock

Only edit:

1. user-requested scope,
2. direct dependencies needed for correctness/build/tests,
3. minimal docs required by rule sources.

Any scope expansion must include a reason.

## Gate Review

Before final output:

1. re-check changes against the Active Rule Set,
2. run required checks for changed scope,
3. ensure any documentation updates are made in canonical docs sources (not in derived artifacts),
4. regenerate/check derived documentation artifacts when applicable,
5. ensure any rule updates are documented for both humans and agents,
6. list unresolved risks explicitly.

If the task is push-bound, run `pnpm qg` before push
(`check:readmes`, `check:policies`, `lint`, `typecheck`, `test`, `build`).

For local iteration speed, use `pnpm qg:changed` to run the same gate graph on affected scope only.

If a gate fails, fix within scope first. Expand scope only with explicit justification.
