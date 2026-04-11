---
title: "enumeration"
sidebar_position: 6
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Snyk security](https://snyk.io/test/npm/@livon/schema/badge.svg)](https://snyk.io/test/npm/@livon/schema)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)

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
