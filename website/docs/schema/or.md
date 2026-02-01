---
title: "or"
sidebar_position: 12
---

Creates union-like schemas with optional discriminator logic.

```ts
import {enumeration, literal, or} from '@livon/schema';

const role = enumeration('Role').values('free', 'pro');
const legacyRole = literal({name: 'LegacyRole', value: 'legacy'});

const roleInput = or({
  name: 'RoleInput',
  options: [role, legacyRole] as const,
});

const value = roleInput.parse('pro');
```

`or.options` can use any value schema from this section.  
API contracts (`api`) are not valid as `or` options.

## Parameters

- `name` (`string`, required): `or` schema name.
- `options` (`readonly Schema[]`, required): candidate schemas.
- `discriminator` (`(input, ctx) => Schema | undefined`, optional): picks one schema before fallback matching.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = or(options)`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>): Schema<T & U>`.

## Related schemas

- [Schema APIs](/docs/schema)
- [union](union)
- [literal](literal)
- [object](object)
- [array](array)
- [tuple](tuple)
- [and](and)
