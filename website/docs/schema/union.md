---
title: "union"
sidebar_position: 11
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema)
[![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema)
[![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts)


Use this schema to validate union options by trying each option until one matches.
`union` is an alias of [or](or).

```ts
import {union, string, number} from '@livon/schema';

const StringOrNumber = union({
  options: [
    string(),
    number(),
  ] as const,
});

const a = StringOrNumber.parse('hello');
const b = StringOrNumber.parse(42);
```

`union.options` can use any value schema from this section.  
API schemas (`api`) are not valid as union options.

## Parameters

- `name` (`string`, optional): explicit union schema name override. If omitted, LIVON derives a deterministic name from option schema names.
- `options` (`readonly Schema[]`, required): candidate schemas.
- `discriminator` (`(input, ctx) => Schema | undefined`, optional): picks one schema before fallback matching.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = union(options)`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [or](or)
- [literal](literal)
- [object](object)
- [array](array)
- [tuple](tuple)
- [and](and)
