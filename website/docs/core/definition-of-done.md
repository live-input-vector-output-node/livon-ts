---
title: Definition of Done
sidebar_position: 8
---

A task is done only if all items below are satisfied.
Use this checklist before merge and release decisions.

## Code quality

- Functional style only (arrow functions, no classes, no `this`).
- ES6 only.
- No loop keywords; use declarative array methods.
- Avoid `any` unless explicitly justified.
- No chained scripts in `package.json` (`&&`, `||`, `;`).
- English only in code, comments, and docs.

## Typing rules

- Use `interface` for object shapes.
- No inline object types.
- No inline function type signatures.
- Every function type must be a named interface.
- Inline types are allowed only for primitives.

## Architecture rules

- Follow package-level architecture rules.
- Keep module boundaries strict (`runtime`, [schema](/docs/schema), `transport`).
- Do not add business logic to transports.

## Tooling and quality gates

Required checks:

```sh
pnpm check:policies
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Parameters

The quality-gate commands above are executed at repository root and do not require additional parameters.

## Tests

- Add or update unit tests when applicable.
- Add integration tests when applicable.
- Keep package test commands green for changed scope.

## Documentation

- Update Docusaurus pages for public API or behavior changes.
- Keep root/package markdown files as redirect stubs only.
