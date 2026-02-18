---
title: "and"
sidebar_position: 16
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-schema.json)](https://www.npmjs.com/package/@livon/schema)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)


Use this combinator to compose multiple schemas on the same input, requiring that the input satisfies all schemas.

## New API (Recommended)

The new `schemas` array-based API supports composing an arbitrary number of schemas:

```ts
import {and, object, string, number} from '@livon/schema';

const MessageInput = object({
  name: 'MessageInput',
  shape: {
    text: string(),
  },
});

const WithId = object({
  name: 'WithId',
  shape: {
    id: string(),
  },
});

const WithTimestamp = object({
  name: 'WithTimestamp',
  shape: {
    timestamp: number(),
  },
});

// Compose two schemas
const MessageWithId = and({
  name: 'MessageWithId',
  schemas: [MessageInput, WithId],
});

const value = MessageWithId.parse({text: 'Hello', id: 'm-1'});

// Compose three or more schemas
const MessageComplete = and({
  name: 'MessageComplete',
  schemas: [MessageInput, WithId, WithTimestamp],
});

const completeValue = MessageComplete.parse({
  text: 'Hello',
  id: 'm-1',
  timestamp: Date.now(),
});
```

## Legacy API

The original `left`/`right` API is still supported for backwards compatibility:

```ts
import {and, object, string} from '@livon/schema';

const MessageInput = object({
  name: 'MessageInput',
  shape: {
    text: string(),
  },
});

const WithId = object({
  name: 'WithId',
  shape: {
    id: string(),
  },
});

const MessageWithId = and({
  left: MessageInput,
  right: WithId,
  name: 'MessageWithId',
});

const value = MessageWithId.parse({text: 'Hello', id: 'm-1'});
```

All schemas in `and` can use any value schema from this section.  
API schemas (`api`) are not valid in `and`.

## Parameters

### New API

- `schemas` (`Schema[]`, required): Array of at least 2 schemas to compose. Each schema is applied in sequence.
- `name` (`string`, optional): Explicit name used for generated AST/type surfaces.

### Legacy API

- `left` (`Schema<T>`, required): First schema.
- `right` (`Schema<U>`, required): Second schema.
- `name` (`string`, optional): Explicit name used for generated AST/type surfaces.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = schema1 & schema2 & ...`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [object](object)
- [array](array)
- [tuple](tuple)
- [union](union)
- [or](or)
- [before](before)
- [after](after)
