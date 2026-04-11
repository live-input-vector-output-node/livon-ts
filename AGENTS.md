<!-- @agent.entry -->
<!-- @agent.load: PROMPT.md -->
<!-- @agent.load: website/docs/ai/active-rules-and-gates.md -->

# AGENTS.md

Repository execution contract for coding agents.

## Canonical Sources
- Recurring repository-wide rules: `/docs/ai/root-gate`
- Scope-specific deviations: `/docs/ai/specializations`
- Context loading policy: `/docs/ai/context-routing`
- Enforcement contract: `/docs/ai/active-rules-and-gates`

## Required Workflow
1. Resolve touched scope.
2. Load nearest `AGENTS.md` hierarchy and routing-required docs.
3. Decide owning layer before implementation.
4. Build Active Rule Set (max 12 bullets).
5. Keep scope lock and explain scope expansion.
6. Run required checks for changed scope.
7. Run gate review before final output.
