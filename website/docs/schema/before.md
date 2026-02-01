---
title: "before"
sidebar_position: 14
---

Runs an input transform/validation hook before schema validation.

```ts
import {before, string} from '@livon/schema';

const userName = before({
  schema: string().min(2),
  hook: (input) => {
    if (typeof input === 'string') {
      return input.trim();
    }
    return input;
  },
});

const value = userName.parse('  alice  ');
```

`before` can wrap any value schema from this section.  
API contracts (`api`) are not valid as `before.schema`.

## Parameters

- `schema` (`Schema<T>`, required): wrapped schema.
- `hook` (`(input, ctx) => SchemaHookBeforeResult`, required): pre-parse hook.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = schema output`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [after](after)
- [and](and)
