---
title: Tool Mapping
sidebar_position: 6
---

This page maps the same control model to Codex and Copilot without duplicating rule text.

## Shared pattern

1. Keep canonical rules in docs and package prompts.
2. Keep agent files small and routing-focused.
3. Prefer scoped context over full-load context.
4. Enforce with gates/checks, not only prompt phrasing.

## Governance rules mapped to tools

Recurring repository-wide governance rules are centralized in [Root Gate](root-gate).
Scope-specific deviations are centralized in [Specializations](specializations).
Codex/Copilot mappings should reference rule ids and specialization ids rather than duplicating full rule text.

## Codex mapping

- Root: `AGENTS.md`
- Scoped: nested `AGENTS.md` files in touched areas
- Optional: skills for on-demand deep tasks

## Copilot mapping

- Root: `.github/copilot-instructions.md`
- Scoped: `.github/instructions/*.instructions.md` with `applyTo`
- Optional: `.github/skills/*/SKILL.md` for reusable workflows

## Compatibility note

Custom tags such as `@agent.load` can remain for internal workflows, but they are not the cross-tool standard.
Use routing intent and scoped files as the portable mechanism.
