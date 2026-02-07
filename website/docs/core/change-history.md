---
title: Governance Change History
sidebar_position: 10
---

This page tracks high-impact governance and rule-system updates.

## 2026-02-15

### Shared coding style guide introduced

- Added shared style patterns for functional, immutable, ES6-first code.
- Added explicit prompt load order for rule context.

### Spread-first and parameter-shape policy locked

- Merge/override objects with spread-first patterns.
- Destructure at boundaries when excluding fields.
- Prefer semantic config objects over primitive multi-arg signatures.
- Order properties by complexity: primitive, array, object, function.

### Prompt system baseline aligned

- Prompt system was split into canonical rules and execution workflow roles.
- Marker-based load paths were introduced for entrypoint files.

### Mutation safety clarified

- Copy before mutating array helpers like `sort`.
- Immutable-by-default policy was made explicit.

### Runtime communication contract clarified

- Module communication is runtime-channel based (`emit*`, `onReceive`, `onSend`, `onError`).
- Modules must not depend on internals of other modules.

## Update policy

When repository-wide governance changes:

1. Update the relevant Docusaurus governance page.
2. Keep prompt entrypoint files in sync with links.
3. Record the change in this history page.
