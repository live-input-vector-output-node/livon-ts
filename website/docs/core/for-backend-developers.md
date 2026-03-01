---
title: For Backend Developers
sidebar_position: 6
---

For backend teams, this page explains request flow, handler execution, and publish flow with LIVON.

## Backend advantages

1. Request parsing, execution, and response validation are schema-defined.
2. Publish-to-subscription mappings are explicit at the operation level.
3. Reliability behavior can stay in runtime modules instead of business handlers.
4. Client-facing schema changes are visible through a single schema source.

## Concrete backend example

An order service adds `publish.onOrderShipped` to an existing `shipOrder` operation.
With LIVON, operation input/output, publish mapping, and subscription payload use one shared schema flow.
Benefit: payload mismatch is caught in runtime flow instead of surfacing later as downstream service bugs.

## Compare all dimensions

Use [How Livon Differs](why-livon-exists#how-livon-differs-from-other-tools) for the full cross-tool comparison table.

## Tradeoffs

1. Some framework shortcuts do not map 1:1 to [schema-first](/docs/schema) flow.
2. Teams need discipline: define schema first, then implement execution.

## Best fit

Use LIVON when backend teams need strict integration points, predictable event handling, and reusable runtime modules across services.
