---
title: "schemaFactory"
sidebar_position: 17
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Snyk security](https://snyk.io/test/npm/@livon/schema/badge.svg)](https://snyk.io/test/npm/@livon/schema)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)

Use `schemaFactory` to build custom schemas when built-in helpers are not enough.

Use this only for advanced custom validators.  
Most app code should use `string`, `number`, `object`, `array`, `or`, `union`, and other standard schema builders.

```ts
import {schemaFactory} from '@livon/schema';

const slug = schemaFactory({
  name: 'Slug',
  type: 'string',
  ast: () => ({type: 'string', name: 'Slug'}),
  validate: (input) => {
    if (typeof input !== 'string') {
      throw {message: 'Expected string'};
    }
    return input.trim().toLowerCase();
  },
});

const value = slug.parse('hello-world');
```

## Parameters

- `name` (`string`, required): schema name.
- `type` (`string`, required): schema type id used in AST/errors.
- `ast` (`(ctx) => AstNode`, required): AST builder.
- `validate` (`(input, ctx) => TValue`, required): runtime validator.
- `doc` (`SchemaDoc`, optional): metadata attached to AST/doc output.
- `chain` (`Record<string, (value, ctx) => (...args) => nextValue>`, optional): fluent chain methods.

## Chain API

- Chain methods are defined inside `chain`.
- Each entry receives `(value: TValue, ctx: SchemaContext)` and returns a function for method args.
- Each chain call returns `SchemaWithChain<TNext, TChain>`, so chains stay immutable.

Minimal chain definition:

```ts
const text = schemaFactory({
  name: 'Text',
  type: 'string',
  ast: () => ({type: 'string', name: 'Text'}),
  validate: (input) => String(input),
  chain: {
    maxLen: (value: string) => (max: number): string => value.slice(0, max),
  },
});

const parsed = text.maxLen(10).parse('hello world');
```

When to use `schemaFactory`:

- building custom schema primitives
- adding custom chain methods
- keeping AST + runtime validation behavior in one place
