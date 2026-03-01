<!-- @agent.entry -->
<!-- @agent.load: PROMPTS.md -->
<!-- @agent.load: website/docs/core/governance.md -->
<!-- @agent.load: website/docs/ai/root-gate.md -->

# LIVON - Root Prompt

Canonical documentation and rule sources live in Docusaurus.

Primary docs entrypoint:

- `/docs`
- file source: `website/docs/index.md`

Governance and engineering rule pages:

- `/docs/core/governance`
- `/docs/core/coding-style-guide`
- `/docs/core/definition-of-done`
- `/docs/core/project-context`
- `/docs/core/change-history`
- `/docs/core/testing-and-quality` (including executable documentation + branch-complete test requirements)

Testing policy note:

- For test creation/review tasks, load `/docs/core/testing-and-quality` as mandatory guidance.

Technical pages:

- `/docs/technical/runtime-design`
- `/docs/technical/architecture`
- `/docs/technical/event-flow`
- `/docs/technical/roadmap`

AI control pages:

- `/docs/ai`
- `/docs/ai/root-gate`
- `/docs/ai/specializations`
- `/docs/ai/context-routing`
- `/docs/ai/active-rules-and-gates`
- `/docs/ai/tool-mapping`

Rule highlights:

- Repository-wide recurring rules are centralized in `/docs/ai/root-gate`.
- Scope-specific deviations are centralized in `/docs/ai/specializations`.
- Keep implementation and documentation synchronized in both directions: implementation changes require docs updates, and rule/behavior docs changes require matching implementation updates.

This file is an agent entrypoint only.
