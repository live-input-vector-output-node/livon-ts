---
title: "string"
sidebar_position: 2
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema)
[![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)


Use this schema to validate strings with optional chain validators.

```ts
import {string} from '@livon/schema';

const UserName = string().min(3).max(20);

const value = UserName.parse('alice');
```

## Parameters

- `name` (`string`, optional): schema node name. Default: `'string'`.
- `doc` (`SchemaDoc`, optional): schema metadata attached to AST/doc output.

## Chain API

- `.min(min: number): Schema<string>`: requires `value.length >= min`.
- `.max(max: number): Schema<string>`: requires `value.length <= max`.
- `.email(): Schema<string>`: requires a valid email format.
- `.regex(pattern: RegExp): Schema<string>`: requires `pattern.test(value) === true`.

Shared methods on current type `T = string`: `optional(): Schema<T | undefined>`, `nullable(): Schema<T | null>`, `describe(doc: SchemaDoc): Schema<T>`, `refine(input): Schema<T>`, `before(hook): Schema<T>`, `after<U>(hook): Schema<U>`, `and<U>(other: Schema<U>, options?: {name?: string}): Schema<T & U>`.
