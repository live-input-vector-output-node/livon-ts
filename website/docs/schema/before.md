---
title: "before"
sidebar_position: 14
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema)
[![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)


Use this wrapper to transform or validate input before schema validation.

```ts
import {before, string} from '@livon/schema';

const UserName = before({
  schema: string().min(2),
  hook: (input) => {
    if (typeof input === 'string') {
      return input.trim();
    }
    return input;
  },
});

const value = UserName.parse('  alice  ');
```

`before` can wrap any value schema from this section.  
API schemas (`api`) are not valid as `before.schema`.

## Parameters

- `schema` (`Schema<T>`, required): wrapped schema.
- `hook` (`(input, ctx) => SchemaHookBeforeResult`, required): pre-parse hook.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = schema output`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [after](after)
- [and](and)
