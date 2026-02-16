---
title: "and"
sidebar_position: 16
---

Use this combinator to require two schemas on the same input.

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

`and.left` and `and.right` can use any value schema from this section.  
API schemas (`api`) are not valid in `and`.

## Parameters

- `left` (`Schema<T>`, required): first schema.
- `right` (`Schema<U>`, required): second schema.
- `name` (`string`, optional): explicit name used for generated AST/type surfaces.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = left & right`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [object](object)
- [array](array)
- [tuple](tuple)
- [union](union)
- [or](or)
- [before](before)
- [after](after)
