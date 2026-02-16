---
title: "union"
sidebar_position: 11
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-schema.json)](https://www.npmjs.com/package/@livon/schema)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)


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
