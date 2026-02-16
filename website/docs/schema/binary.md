---
title: "binary"
sidebar_position: 13
---

Use this schema to validate binary payloads based on `Uint8Array`.

```ts
import {binary} from '@livon/schema';

const BinaryPayload = binary({name: 'BinaryPayload'});

const bytes = new Uint8Array([1, 2, 3]);
const value = BinaryPayload.parse(bytes);
```

## Parameters

- `name` (`string`, required): schema node name.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = Uint8Array`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [object](object)
- [array](array)
- [union](union)
- [or](or)
