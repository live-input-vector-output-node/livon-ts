---
title: What Is LIVON and Why
sidebar_position: 1
---

LIVON is a TypeScript-first [runtime](/docs/packages/runtime) and [schema](/docs/schema) ecosystem for event-driven systems.

## What LIVON gives you

1. A shared event envelope model for client and server runtimes.
2. [Schema-first contracts](/docs/schema) for operations and subscriptions.
3. Runtime modules with strict boundaries (`transport`, [schema](/docs/schema), reliability modules).
4. Generated client APIs from server [schema AST](/docs/schema).

## Why use LIVON

1. **Symmetry**: same runtime composition pattern on frontend and backend.
2. **Predictable data flow**: [schema validation](/docs/schema) at contract boundaries.
3. **Composability**: features live in modules, not in one monolith.
4. **Type safety**: types derive from [schemas](/docs/schema) and generated contracts.
5. **Scalability of architecture**: add modules (`retry`, `DLQ`, custom transports) without rewriting the core.

## Design principles

1. Functional and immutable code style.
2. Event-driven communication between modules.
3. [Schema-driven validation](/docs/schema) and generated client contracts.
4. Transport modules only transport, [schema modules](/docs/packages/schema) only validate/execute contracts.

## Next step

1. Read [How LIVON Differs From Other Tools](livon-vs-others) for positioning.
2. Continue with [Getting Started](getting-started) for setup and first runtime wiring.
