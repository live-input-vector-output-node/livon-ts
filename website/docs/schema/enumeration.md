---
title: "enumeration"
sidebar_position: 6
---

Creates enum-like schemas from explicit values.

```ts
import {enumeration} from '@livon/schema';

const role = enumeration('Role').values('free', 'pro', 'team');

const value = role.parse('pro');
const onlyPro = role.literal('pro').parse('pro');
```

## Parameters

- `enumeration(name, doc?)`
- `name` (`string`, required): enum group name.
- `doc` (`SchemaDoc`, optional): metadata attached to the enum schema.
- `.values(...values)` (`(string | number)[]`, required): allowed values (at least one).

## Chain API

- `.literal(only: TValue): Schema<TValue>`: narrows to one exact enum member.
- Shared methods on current type `T = TValue`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>): Schema<T & U>`.

## Related schemas

- [literal](literal)
- [union](union)
- [or](or)
