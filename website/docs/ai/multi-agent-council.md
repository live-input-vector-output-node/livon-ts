---
title: Multi-Agent Council
sidebar_position: 8
---

This page defines the repository standard for multi-agent collaboration.

Machine-readable source:

- `configs/ai/multi-agent-council.json`

## Goal

Use role-specialized agents that advise each other with a fixed decision flow:

1. PO/DX defines how features should feel in use.
2. System architecture defines boundaries and contracts.
3. Backend and frontend architecture refine implementation plans.
4. Performance specialist validates latency, throughput, and cost budgets.
5. Test quality specialist validates contract clarity, setup deduplication, and gate readiness.
6. Council orchestrator resolves conflicts and emits one final decision.

## Roles

- `po-dx-designer`
- `system-architect`
- `backend-architect`
- `frontend-architect`
- `performance-specialist`
- `test-quality-specialist`
- `multi-agent-council` (orchestrator)

Role skill files are stored under `.github/skills/*/SKILL.md`.

## Required flow constraints

- PO/DX stage must run first.
- Architecture stages must consult each other (system, backend, frontend).
- Performance review must complete before final decision.
- Final decision must include tradeoffs and unresolved risks.

## Council Threshold

Use multi-agent council mode when at least one of these is true:

- The task spans multiple domains (for example DX intent plus architecture plus performance/quality gates).
- The task changes repository-wide policies, governance rules, or quality gates.
- The task needs explicit cross-role tradeoff decisions before implementation.

Use single-agent mode when all of these are true:

- The task is local to one package/path.
- No cross-role tradeoff is needed (no policy/architecture/performance/quality conflict).
- The change can be implemented and validated linearly.

## Execution contract

When a task is large enough for multi-agent mode:

1. Load root and scoped `AGENTS.md` hierarchy.
2. Load role skills relevant to the stage.
3. Produce stage outputs in order from `configs/ai/multi-agent-council.json`.
4. Run gate review after the final council decision.

Keep single-agent mode for small linear changes.
