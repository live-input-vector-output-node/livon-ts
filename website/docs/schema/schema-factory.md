---
title: "schemaFactory"
sidebar_position: 17
---

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
