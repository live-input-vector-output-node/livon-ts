---
title: Specializations
sidebar_position: 3
---

This page defines package/folder-specific deviations from recurring repository-wide rules.

Recurring global rules stay in [Root Gate](root-gate).
Package or folder-specific deviations are registered in:

- `configs/ai/specializations.json`

## Policy

1. If a rule is the same across scopes, keep it in [Root Gate](root-gate).
2. If a package/folder needs a deviation, register it in `configs/ai/specializations.json`.
3. Instruction files that participate in specialization deltas must reference a valid `specialization-id` and be registered in `configs/ai/specializations.json`.
4. Do not duplicate recurring root rules in scoped files.

## Current specialization ids

- `client-generator`
- `runtime-core`
- `schema-core`

Use these ids in scoped instruction files via `specialization-id:` markers.

## Runtime-core boundary note

`runtime-core` enforces strict runtime isolation:

- keep runtime hook order and context boundaries deterministic,
- keep runtime concerns separate from transport/schema implementation details,
- disallow runtime imports from `@livon/client`, `@livon/schema`, and transport packages.
