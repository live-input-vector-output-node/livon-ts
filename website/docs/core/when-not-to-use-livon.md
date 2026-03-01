---
title: When Not to Use Livon
sidebar_position: 8
---

LIVON is strongest when integration points and event flow are core concerns.  
It is not the best default for every project.

## Cases where LIVON is usually not a fit

1. Very simple CRUD systems with stable request/response shape and low boundary complexity.
2. Static content websites without runtime schema exchange.
3. Architectures without centralized schema governance ownership.
4. Systems that are not event-driven and do not need publish/subscription interface symmetry.

## Decision guideline

Use LIVON when you need deterministic checks across:

- transport input
- runtime execution
- publish/subscription payloads
- generated client API schemas

If these integration points are not a meaningful risk or coordination surface, a simpler stack may be preferable.

## Related concepts

- [Why Livon Exists](why-livon-exists)
- [How Livon Differs](why-livon-exists#how-livon-differs-from-other-tools)
