---
title: Approach and Rationale
sidebar_position: 7
---

This page explains why Livon uses a small control plane for agents instead of full-load prompt files.

## Goals

1. Lower token usage without dropping critical rules.
2. Improve consistency by routing only relevant context.
3. Keep one documentation truth for humans and agents.
4. Support both Codex and Copilot with the same governance model.

## Design decisions

1. Keep canonical engineering and product rules in docs and package prompts.
2. Keep `AGENTS.md` small and operational (routing, scope lock, gates).
3. Use scoped loading over hard full-load links.
4. Use active rules plus gate review as enforcement.
5. Use skills for deep, task-specific behavior.
6. Keep routing machine-readable for regression checks and metrics.

## Why this model

Full-load context increases token cost and reduces instruction clarity in large monorepos.
Scoped routing and progressive disclosure keep high-signal context active while preserving full rule coverage through conditional loading.

## Operational checks

- `pnpm check:policies` validates:
  - required AI control files,
  - routing fixtures from `configs/ai/context-routing.json`,
  - root load-budget limits,
  - naming consistency for AI markdown.
- `pnpm metrics:ai-control` reports routing/load metrics for trend tracking.

## Multi-agent policy

Use multi-agent mode for parallelizable tasks (exploration, review shards, migration decomposition).
Keep single-agent mode for small or linear tasks.

## Official references

Codex and AGENTS:

- [OpenAI Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)
- [OpenAI Codex Skills](https://developers.openai.com/codex/skills)
- [OpenAI Codex Multi-agents](https://developers.openai.com/codex/multi-agent)
- [OpenAI harness engineering article](https://openai.com/index/harness-engineering/)

Copilot custom instructions and skills:

- [GitHub repository/path custom instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)
- [GitHub response customization and precedence](https://docs.github.com/en/copilot/concepts/prompting/response-customization)
- [GitHub Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)

Open standards used by this approach:

- [AGENTS.md standard](https://agents.md/)
- [Agent Skills specification](https://agentskills.io/specification)
- [MCP specification](https://modelcontextprotocol.io/specification)
