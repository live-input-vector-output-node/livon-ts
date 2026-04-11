---
title: Project Context
sidebar_position: 9
---

For maintainers and contributors, this page summarizes current focus, constraints, and near-term priorities.

## Current focus

- Build a predictable event runtime with `onReceive`, `onSend`, and `onError`.
- Keep [schema-first design](/docs/schema) as the center for validation and generated typing.
- Keep transport responsibilities minimal and transport-only.

## Near-term implementation focus

1. Runtime reliability modules (`retry`, `DLQ`, queue orchestration).
2. [Schema metadata](/docs/schema) expansion and schema docs.
3. Generated client DX improvements.
4. Release and contribution automation.

## Constraints

- English-only public surface.
- Functional, immutable, ES6-first implementation.
- [Schema-first typing and validation](/docs/schema).
- Shared configuration from `@livon/typescript`, `@livon/eslint`, `@livon/rslib`, `@livon/rsbuild`, `@livon/rspack`, and `@livon/vitest`.
