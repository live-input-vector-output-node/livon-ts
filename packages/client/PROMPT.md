<!-- @agent.entry -->
<!-- @agent.load: ../../PROMPT.md -->
<!-- @agent.load: ../../PROMPTS.md -->
<!-- @agent.load: ../AGENTS.md -->
<!-- @agent.load: ../../website/docs/packages/client-sync.md -->
<!-- @agent.load: ../../website/docs/core/schema-doc-and-generated-jsdoc.md -->
<!-- @agent.load: ../../website/docs/packages/client.md -->

# @livon/client Prompt

This prompt applies only to the client package.

Canonical sources:

- `/docs/packages/client`
- `/docs/packages/client-sync`
- `/docs/core/schema-doc-and-generated-jsdoc`

Client sync rule:

- Any change in generated client runtime behavior must update documentation in:
  - `website/docs/core/schema-doc-and-generated-jsdoc.md`
  - `website/docs/packages/client.md`
- Keep generated client terminology and examples aligned with documented terminology and examples.
- Validate sync behavior with `packages/client-sync/src/index.spec.ts`.
