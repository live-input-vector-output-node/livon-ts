---
title: "or"
sidebar_position: 12
---

Use this combinator to validate with multiple schema options and optional discriminator logic.
`union` is an alias of this API.

```ts
import {enumeration, literal, or} from '@livon/schema';

const Role = enumeration('Role').values('free', 'pro');
const LegacyRole = literal({name: 'LegacyRole', value: 'legacy'});

const RoleInput = or({
  options: [Role, LegacyRole] as const,
});

const value = RoleInput.parse('pro');
```

`or.options` can use any value schema from this section.  
API schemas (`api`) are not valid as `or` options.

## Parameters

- `name` (`string`, optional): explicit `or` schema name override. If omitted, LIVON derives a deterministic name from option schema names.
- `options` (`readonly Schema[]`, required): candidate schemas.
- `discriminator` (`(input, ctx) => Schema | undefined`, optional): picks one schema before fallback matching.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = or(options)`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [union](union)
- [literal](literal)
- [object](object)
- [array](array)
- [tuple](tuple)
- [and](and)
