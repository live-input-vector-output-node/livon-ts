---
title: "after"
sidebar_position: 15
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-schema.json)](https://www.npmjs.com/package/@livon/schema)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)


Use this schema wrapper to run post-parse transforms on validated values.

```ts
import {after, string} from '@livon/schema';

const LowerUserName = after({
  schema: string().min(2),
  hook: (value) => value.toLowerCase(),
});

const value = LowerUserName.parse('ALICE');
```

`after` can wrap any value schema from this section.  
API schemas (`api`) are not valid as `after.schema`.

## Parameters

- `schema` (`Schema<T>`, required): wrapped schema.
- `hook` (`(value, ctx) => SchemaHookAfterResult`, required): post-parse hook.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = hook output`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [before](before)
- [and](and)
