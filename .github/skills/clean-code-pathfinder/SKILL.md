---
name: clean-code-pathfinder
description: Review and improve code quality continuously by enforcing semantic file boundaries, single responsibility, separation of concerns, and immediate in-scope refactors when design friction is found.
---

# Clean Code Pathfinder

## Use when

- A feature or fix touches implementation files and architecture quality must not regress.
- Files are growing and need semantic splits by domain/slice/responsibility.
- Duplicated logic or mixed concerns are discovered during implementation.

## Steps

1. Evaluate touched files for single responsibility, separation of concerns, and reusable extraction opportunities.
2. Check for reusable implementations in current scope first, then across packages; when the same utility logic exists in another package, consolidate toward `@livon/utils` instead of duplicating.
3. If friction/duplication/tangled concerns are found in the touched scope, refactor immediately in the same change ("Pathfinder rule": always leave code cleaner than before).
4. If existing code in touched scope violates active repository rules, refactor it in the same change when feasible and safe.
5. When multiple candidate implementations exist, choose the most performant and cleanest one, or combine strengths into one shared configurable implementation.
6. When a file becomes too large or semantically mixed, split by domain/slice into a folder with explicit boundaries (for example `index.ts`, `types.ts`, `createContext.ts`, feature implementation files).
7. Keep strict scope discipline: avoid opportunistic out-of-scope changes and expand only for direct correctness/build/test/policy dependencies.
8. Keep local APIs stable with barrel exports and preserve package-level public export contracts.
