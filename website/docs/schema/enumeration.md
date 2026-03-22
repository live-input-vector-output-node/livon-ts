---
title: "enumeration"
sidebar_position: 6
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema)
[![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema)
[![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts)


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
