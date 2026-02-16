<!-- @agent.entry -->
<!-- @agent.load: ../../PROMPT.md -->
<!-- @agent.load: ../../PROMPTS.md -->
<!-- @agent.load: ../../AGENTS.md -->
<!-- @agent.load: ../../website/docs/core/generators.md -->
<!-- @agent.load: ../../website/docs/core/schema-doc-and-generated-jsdoc.md -->
<!-- @agent.load: ../../website/docs/packages/client.md -->

# @livon/client Prompt

This prompt applies only to the client package.

Canonical sources:

- `/docs/packages/client`
- `/docs/core/generators`
- `/docs/core/schema-doc-and-generated-jsdoc`

Generator sync rule:

- Any change in `packages/client/src/generate.ts`, `packages/client/src/typeScriptSurfaceTemplate.ts`, or `packages/client/templates/*` that affects generated API output must update documentation in:
  - `website/docs/core/schema-doc-and-generated-jsdoc.md`
  - `website/docs/packages/client.md`
- Keep generated JSDoc terminology and examples aligned with documented terminology and examples.
- Validate generator behavior with `packages/client/src/generate.spec.ts`.
