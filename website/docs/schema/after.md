---
title: "after"
sidebar_position: 15
---

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
