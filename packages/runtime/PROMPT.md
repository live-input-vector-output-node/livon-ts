<!-- @agent.entry -->
<!-- @agent.load: ../../AGENTS.md -->
<!-- @agent.load: ../../website/docs/packages/runtime.md -->
<!-- @agent.load: ../../website/docs/technical/runtime-design.md -->
<!-- @agent.load: ../../website/docs/technical/architecture.mdx -->
<!-- @agent.load: ../../website/docs/technical/event-flow.mdx -->
<!-- @agent.load: ../../website/docs/core/testing-and-quality.md -->

# @livon/runtime Prompt

This prompt applies only to the runtime package.

Canonical sources:

- `/docs/packages/runtime`
- `/docs/technical/runtime-design`
- `/docs/technical/architecture`
- `/docs/technical/event-flow`
- `/docs/core/testing-and-quality`

Runtime boundary rules:

- Keep runtime free from client, schema, and transport-specific implementation logic.
- Preserve deterministic hook order and context boundaries.
- Keep runtime communication contract-driven (`emit*`, `onReceive`, `onSend`, `onError`).

Validation:

- Run `pnpm -C packages/runtime test:unit` and `pnpm -C packages/runtime test:integration` for runtime behavior changes.
