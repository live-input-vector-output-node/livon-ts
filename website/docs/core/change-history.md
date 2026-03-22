---
title: Governance Change History
sidebar_position: 10
---

This page tracks high-impact governance and rule-system updates.
Use it when you need to understand why repository-wide rules changed.

## 2026-03-22

### Arrow-only callable style added to root gate

- Added recurring repository-wide rule `arrow-functions-only`.
- Rule enforces arrow functions as default callable style and forbids `function` keyword usage for implementations and overload declarations.
- Overload pattern is standardized to callable `interface` signatures plus `const` arrow assignments.
- Added recurring repository-wide rule `test-setup-deduplication`.
- Rule requires checking for similar existing tests first and extracting repeated test setup into shared `beforeEach` blocks or test utilities.
- Extended multi-agent council with `test-quality-specialist` role and quality-gates stage before final council decision.
- Documented explicit threshold for when to use multi-agent council versus single-agent mode.
- Added lint warning budget entry for `@livon/react` in `configs/quality/lint-warning-budgets.json`.
- Added recurring repository-wide rule `modular-file-structure` (scoped `utils/` folders, one utility per file, index barrel exports, focused feature files, and explicit `package.json` exports boundaries).

## 2026-03-20

### Hierarchical instruction inheritance enforced

- Added explicit hierarchical instruction inheritance rule:
  root `AGENTS.md` plus nearest parent `AGENTS.md` chain for scoped work.
- Added policy enforcement for parent-chain loading in AI instruction files.
- Updated context routing docs to describe deterministic root-to-scope inheritance.
- Added subtree scope layers for `apps/**`, `packages/**`, and `tools/**` to support strict top-down rule propagation.
- Updated specialization policy checks so only files with `specialization-id` markers must be registered.

### Multi-agent role council introduced

- Added role-based council contract with machine-readable stage flow in `configs/ai/multi-agent-council.json`.
- Added role skills for PO/DX, system architecture, backend, frontend, performance, and council orchestration.
- Added policy validation for council config integrity and role-skill references.
- Added AI docs + routing entries for multi-agent council usage.

### Runtime boundary guard tightened

- Added runtime-scoped prompt entrypoint (`packages/runtime/PROMPT.md`).
- Added policy checks that block runtime imports from client/schema/transport packages.
- Runtime specialization now explicitly declares the import boundary constraint.

## 2026-02-15

### Shared coding style guide introduced

- Added shared style patterns for functional, immutable, ES6-first code.
- Added explicit prompt load order for rule context.

### Spread-first and parameter-shape policy locked

- Merge/override objects with spread-first patterns.
- Destructure at boundaries when excluding fields.
- Prefer semantic config objects over primitive multi-arg signatures.
- Order properties by complexity: primitive, array, object, function.

### Prompt system baseline aligned

- Prompt system was split into canonical rules and execution workflow roles.
- Marker-based load paths were introduced for entrypoint files.

### Mutation safety clarified

- Copy before mutating array helpers like `sort`.
- Immutable-by-default policy was made explicit.

### Runtime communication schema clarified

- Module communication is runtime-channel based (`emit*`, `onReceive`, `onSend`, `onError`).
- Modules must not depend on internals of other modules.

## Update policy

When repository-wide governance changes:

1. Update the relevant Docusaurus governance page.
2. Keep prompt entrypoint files in sync with links.
3. Record the change in this history page.
