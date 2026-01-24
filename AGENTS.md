<!-- @agent.entry -->
<!-- @agent.load: PROMPT.md -->
<!-- @agent.load: PROMPTS.md -->
<!-- @agent.load: website/docs/core/governance.md -->
<!-- @agent.load: website/docs/core/contributing.md -->
<!-- @agent.load: website/docs/core/testing-and-quality.md -->
<!-- @agent.load: website/docs/technical/runtime-design.md -->
<!-- @agent.load: packages/schema/PROMPT.md -->

# AGENTS.md

This file defines how coding agents should operate in this repository.
Canonical product and engineering documentation lives in Docusaurus (`/docs`).

## Scope
- Applies to the entire `new_livon` repository.
- Use this as the execution guide.
- Use prompt files as the canonical rule source.
- Change history: `CHANGE_HISTORY.md`.

## Rule source policy
- Do not duplicate canonical engineering rules in this file.
- Keep canonical constraints in `PROMPT.md`.
- Use this file for execution behavior, workflow, and conflict handling.

## Context Load Order
1. Read `PROMPT.md`.
2. Read `PROMPTS.md`.
3. Read `/docs/core/governance`.
4. Load package-specific prompt entrypoints based on touched paths.
5. For schema work, read `packages/schema/PROMPT.md`, `/docs/packages/schema`, and `/docs/schema`.

## Editing and Change Policy
- Prefer normal editor-style changes for source files.
- If a script-based file rewrite is required, request approval first.
- Keep changes focused to the task.
- Do not introduce unnecessary dependencies.
- If a third-party dependency is required, include `THIRD_PARTY_NOTICES.md` with full license text in that package.
- Do not edit `dist/` or `node_modules/`.

## Execution Workflow
1. Identify target area from user request.
2. Load relevant prompt files for that area.
3. Implement according to canonical constraints in `PROMPT.md` and local package prompts.
4. Run relevant checks (`pnpm check:policies`, plus targeted typecheck/test/build for changed scope).
5. Report what changed, what was validated, and any remaining risks.

## Documentation maintenance workflow
1. For repository-wide rule updates, modify `PROMPT.md` first.
2. If execution behavior changes, update `AGENTS.md`.
3. If prompt inventory changes, update `PROMPTS.md`.
4. If package-local rules change, update that package `PROMPT.md`.

## Conflict Resolution
- External system/developer/user instructions take precedence over this file.
- Inside repo context, package-specific prompt rules override generic guidance in this file.
- Root `PROMPT.md` remains the baseline when no package prompt applies.
