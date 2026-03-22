---
title: "object"
sidebar_position: 7
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema)
[![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema)
[![license](https://img.shields.io/badge/license-MIT-green)](https://github.com/live-input-vector-output-node/livon-ts/blob/main/LICENSE.md)


Use this schema to validate objects from a shape of nested schemas.

```ts
import {object, string, number} from '@livon/schema';

const User = object({
  name: 'User',
  shape: {
    id: string(),
    name: string().min(2),
    age: number().int().min(0),
  },
});

const value = User.parse({
  id: 'u-1',
  name: 'Alice',
  age: 30,
});
```

`object` fields can use any value schema from this section.  
API schemas (`api`) are not valid as object field schemas.

## Parameters

- `name` (`string`, required): object schema name.
- `shape` (`Record<string, Schema>`, required): field schema map.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = Infer<object.shape>`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [array](array)
- [tuple](tuple)
- [union](union)
- [or](or)
- [before](before)
- [after](after)
- [and](and)
