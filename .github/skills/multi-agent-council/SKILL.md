---
name: multi-agent-council
description: Orchestrate role-based collaboration across PO/DX, system architecture, backend, frontend, and performance specialists with deterministic handoffs.
---

# Multi-Agent Council

## Use when

- A task spans product intent, architecture, implementation, and performance decisions.
- Parallel specialist review or staged specialist handoffs are needed.

## Steps

1. Load `configs/ai/multi-agent-council.json`.
2. Run stages in configured order and collect role outputs.
3. Resolve conflicts with explicit tradeoff notes.
4. Emit one consolidated decision with risks and required checks.
