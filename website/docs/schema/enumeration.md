---
title: "enumeration"
sidebar_position: 6
---

Use this schema to validate enum-like values from explicit members.

```ts
import {enumeration} from '@livon/schema';

const Role = enumeration('Role').values('free', 'pro', 'team');

const value = Role.parse('pro');
const onlyPro = Role.literal('pro').parse('pro');
```

## Parameters

- `enumeration(name, doc?)`
- `name` (`string`, required): enum group name.
- `doc` (`SchemaDoc`, optional): metadata attached to the enum schema.
- `.values(...values)` (`(string | number)[]`, required): allowed values (at least one).

## Chain API

- `.literal(only: TValue): Schema<TValue>`: narrows to one exact enum member.
- Shared methods on current type `T = TValue`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [literal](literal)
- [union](union)
- [or](or)
