---
name: update-mermaid
description: Keep architecture Mermaid diagrams aligned with dependency and runtime changes.
---

# Update Mermaid

## Use when

- Layer boundaries change.
- Runtime flow or hook ordering changes.
- Event flow or architecture contracts change.

## Steps

1. Identify affected architecture docs under `website/docs/technical/**`.
2. Update Mermaid diagrams referenced by those docs.
3. Verify diagrams do not introduce forbidden dependency edges.
4. Summarize what changed and why it is consistent with current code.

