---
title: How To Make Custom Schema
sidebar_position: 4
---

For advanced schema authors, this page shows how to build custom [schemas](/docs/schema) with [schemaFactory](/docs/schema/schema-factory).

## Step 1: define schema input

```ts
import {schemaFactory} from '@livon/schema';

interface SlugSchemaInput {
  name: string;
}
```

### Parameters in this example

`SlugSchemaInput`:

- `name` (`string`): schema name used in AST and error metadata.

## Step 2: create schema with validate + ast

```ts
import {schemaFactory} from '@livon/schema';

interface SlugSchemaInput {
  name: string;
}

export const slug = ({name}: SlugSchemaInput) =>
  schemaFactory<string>({
    name,
    type: 'slug',
    ast: () => ({type: 'slug', name}),
    validate: (input) => {
      if (typeof input !== 'string') {
        throw {message: 'Expected string', code: 'slug.type'};
      }

      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(input)) {
        throw {message: 'Expected slug format', code: 'slug.format'};
      }

      return input;
    },
  });
```

### Parameters in this example

`slug({name})`:

- `name` (`string`): custom schema node name.

`schemaFactory({...})`:

- `name` (`string`): schema name.
- `type` (`string`): schema type id.
- `ast` (`(ctx) => AstNode`): AST builder function.
- `validate` (`(input, ctx) => value`): runtime validator function.

## Step 3: use custom schema in object schemas

```ts
import {object, string} from '@livon/schema';
import {slug} from './slug.js';

const Article = object({
  name: 'Article',
  shape: {
    id: string({name: 'ArticleId'}),
    slug: slug({name: 'ArticleSlug'}),
  },
});
```

### Parameters in this example

`object({...})`:

- `name` (`string`): object schema name.
- `shape` (`Record<string, Schema>`): field schema map.

`string({name})`:

- `name` (`string`): field schema node name for AST/error output.

`slug({name})`:

- `name` (`string`): field-specific custom schema node name.

## Rules for custom schemas

1. Keep one schema per file.
2. Export through `src/index.ts`.
3. Provide a dedicated docs page with usage examples in [Schema APIs](/docs/schema).
