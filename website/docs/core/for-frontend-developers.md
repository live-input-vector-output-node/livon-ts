---
title: For Frontend Developers
sidebar_position: 5
---

For frontend teams, this page explains UI state, event payloads, and predictable data flow with LIVON.

## Frontend advantages

1. Typed generated client calls reduce handwritten request and event typings.
2. Subscription callbacks follow one deterministic callback shape across features.
3. State updates stay schema-aligned because payload types are generated from schema.
4. Refactors break earlier in editor/typecheck instead of late in runtime.

## Concrete frontend example

A chat screen adds message reactions and unread counters.
With LIVON, the team uses generated operation calls for writes and typed subscription callbacks for updates:
`api.sendReaction(...)` and `api({ onReaction: (payload) => ... })`.
Benefit: component state updates use one schema shape, so refactors stay predictable.

## Compare all dimensions

Use [How Livon Differs](how-livon-differs) for the full cross-tool comparison table.

## Tradeoffs

1. You follow a shared runtime convention instead of fully custom per-app event plumbing.
2. Schema changes should start in [schema](/docs/schema), then regenerate client types.

## Best fit

Use LIVON when frontend teams ship realtime UI and want fewer integration surprises between UI state and backend APIs.
