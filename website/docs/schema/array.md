---
title: "array"
sidebar_position: 8
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema)
[![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema)
[![license](https://img.shields.io/badge/license-MIT-green)](https://github.com/live-input-vector-output-node/livon-ts/blob/main/LICENSE.md)


Use this schema to validate arrays with item-level validation.

```ts
import {array, string} from '@livon/schema';

const Tags = array({
  name: 'Tags',
  item: string().min(1),
});

const value = Tags.parse(['livon', 'schema']);
```

`array.item` can use any value schema from this section.  
API schemas (`api`) are not valid as array item schemas.

## Parameters

- `name` (`string`, required): array schema name.
- `item` (`Schema<T>`, required): item schema.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = item[]`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [object](object)
- [tuple](tuple)
- [union](union)
- [or](or)
- [and](and)
