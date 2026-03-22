---
title: "literal"
sidebar_position: 10
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema)
[![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema)
[![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts)


Use this schema to validate one exact primitive value.

```ts
import {literal} from '@livon/schema';

const StatusActive = literal({
  name: 'StatusActive',
  value: 'active',
});

const value = StatusActive.parse('active');
```

## Parameters

- `name` (`string`, required): schema node name.
- `value` (`string | number | boolean`, required): exact accepted value.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- No schema-specific chain methods.
- Shared methods on current type `T = string | number | boolean` (based on literal value): `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.

## Related schemas

- [enumeration](enumeration)
- [union](union)
- [or](or)
