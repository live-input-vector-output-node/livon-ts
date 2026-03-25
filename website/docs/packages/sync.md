---
title: "@livon/sync"
sidebar_position: 8
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fsync)](https://www.npmjs.com/package/@livon/sync)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fsync?label=dependencies)](https://libraries.io/npm/%40livon%2Fsync)
[![npm publish](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/publish.yml?branch=main&label=npm%20publish)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/publish.yml)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![Snyk security](https://snyk.io/test/npm/@livon/sync/badge.svg)](https://snyk.io/test/npm/@livon/sync)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fsync?label=package%20size)](https://www.npmjs.com/package/@livon/sync)
[![license](https://img.shields.io/npm/l/%40livon%2Fsync)](https://www.npmjs.com/package/@livon/sync)

## Purpose

[@livon/sync](/docs/packages/sync) is the core sync layer for entity-centric state with three unit types:

- `source` for reads and cache-aware refetch flows
- `action` for writes and mutations
- `stream` for realtime subscriptions

It also provides:

- `view` for read-only derived units
- `transform` for derived read/write units

`@livon/sync` is framework-agnostic and consumed by adapters such as `@livon/react`.

## Install

```sh
pnpm add @livon/sync
```

## Core DX

```ts
import { action, entity, source, stream, transform, view } from '@livon/sync';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  listId: string;
}

interface TodoScope {
  listId: string;
}

interface ReadTodosPayload {
  query: string;
}

interface UpdateTodoPayload {
  id: string;
  title: string;
}

const todoEntity = entity<Todo>({
  idOf: (value) => value.id,
  ttl: 30_000,
  draft: 'global',
  destroyDelay: 250,
});

const readTodos = source<TodoScope, ReadTodosPayload, Todo, readonly Todo[]>({
  entity: todoEntity,
  ttl: 60_000,
  defaultValue: [],
  run: async ({ scope, payload, setMeta, entity }) => {
    setMeta({ request: 'loading-todos' });
    const todos = await api.readTodos({
      listId: scope.listId,
      query: payload.query,
    });

    entity.upsertMany(todos, { merge: true });
  },
});

const updateTodo = action<TodoScope, UpdateTodoPayload, Todo, Todo | null>({
  entity: todoEntity,
  run: async ({ scope, payload, entity }) => {
    const updated = await api.updateTodo({
      id: payload.id,
      listId: scope.listId,
      title: payload.title,
    });

    entity.upsertOne(updated, { merge: true });
  },
});

const onTodoEvents = stream<TodoScope, undefined, Todo, null>({
  entity: todoEntity,
  run: async ({ scope }) => {
    return api.subscribeTodoEvents({
      listId: scope.listId,
      onEvent: (event) => {
        if (event.type !== 'changed') {
          return;
        }

        // Source stays read-only; stream triggers explicit source refetch.
        const todoListUnit = readTodos({ listId: scope.listId });
        void todoListUnit.refetch();
      },
      onError: () => {
        return;
      },
    });
  },
});

const todoCount = view<TodoScope, number>({
  defaultValue: 0,
  out: async ({ scope, get }) => {
    const todosSnapshot = await get(readTodos(scope));
    return todosSnapshot.value.length;
  },
});

const todoTitleTransform = transform<TodoScope, UpdateTodoPayload, string>({
  defaultValue: '',
  out: async ({ scope, get }) => {
    const todosSnapshot = await get(readTodos(scope));
    return todosSnapshot.value[0]?.title ?? '';
  },
  in: async ({ scope, payload, set }) => {
    await set(updateTodo(scope), payload);
  },
});
```

## Unit Identity Rule

`scope` defines unit identity. `run(payload)` defines execution.

- Same `scope` => same unit/store instance
- Different `scope` => different unit/store instance

### Shared store with different executions

Use `run(payload)` when all consumers should share one store:

```ts
const todoListUnit = readTodos({ listId: 'list-1' });

await todoListUnit.run({ query: 'open' });
await todoListUnit.run({ query: 'mine' });

// same unit, same shared store, latest run updates that store
```

### Separate stores per search result

Put search into `scope` when each search result needs its own store:

```ts
interface TodoSearchScope {
  listId: string;
  query: string;
}

const readTodosByScope = source<TodoSearchScope, undefined, Todo, readonly Todo[]>({
  entity: todoEntity,
  defaultValue: [],
  run: async ({ scope, entity }) => {
    const todos = await api.readTodos(scope);
    entity.upsertMany(todos);
  },
});

const openUnit = readTodosByScope({ listId: 'list-1', query: 'open' });
const mineUnit = readTodosByScope({ listId: 'list-1', query: 'mine' });

// different scopes => different stores
```

## Runtime Usage

```ts
const todoListUnit = readTodos({ listId: 'list-1' });
const updateTodoUnit = updateTodo({ listId: 'list-1' });
const todoEventsUnit = onTodoEvents({ listId: 'list-1' });
const todoCountViewUnit = todoCount({ listId: 'list-1' });
const todoTitleTransformUnit = todoTitleTransform({ listId: 'list-1' });

await todoListUnit.run({ query: 'open' });
await todoListUnit.refetch(); // reuse previous payload
await todoListUnit.refetch({ query: 'mine' }); // override payload for refetch
await todoListUnit.force({ query: 'mine' }); // bypass run dedupe for same payload

const todoList = todoListUnit.get();

await updateTodoUnit.run({
  id: todoList[0].id,
  title: 'Updated title',
});

todoEventsUnit.start();
todoEventsUnit.stop();

todoListUnit.draft.set((previousTodos) => {
  return previousTodos.map((todo, index) => {
    if (index !== 0) {
      return todo;
    }

    return {
      ...todo,
      title: `${todo.title} (draft)`,
    };
  });
});
todoListUnit.draft.clean();
todoListUnit.reset(); // restore source unit state to its initial value/status/meta/context

const todoCountSnapshot = todoCountViewUnit.get();
await todoTitleTransformUnit.set({
  id: todoList[0].id,
  title: 'From transform',
});
const todoTitleSnapshot = todoTitleTransformUnit.get();

const removeListener = todoListUnit.effect((snapshot) => {
  console.log(snapshot.status, snapshot.meta, snapshot.context);
});

removeListener?.();
todoListUnit.destroy();
```

## `view` and `transform`

- `view` is read-only and recomputes from dependencies accessed via `get(...)`.
- `transform` has `out` (read) and optional `in` (write). Its `set(...)` calls `in`.
- In both units, `get()` returns a full snapshot (`value`, `status`, `meta`, `context`), not only raw `value`.

## Structured Value Support

`@livon/sync` uses msgpack-based serialization for scope/payload keys and source cache rehydration.
Scope and payload inputs must be msgpack-serializable.

Round-trips preserve common non-JSON values such as:

- `Date`
- `BigInt`
- `undefined`
- `NaN`, `Infinity`, `-Infinity`, `-0`
- `RegExp`
- `Map`
- `Set`

Functions and symbols are not valid scope/payload values for key serialization.

## API Summary

### `entity({ ... })`

- `idOf`: required id extractor
- `ttl`: optional entity ttl fallback
- `draft`: optional draft mode (`global` | `scoped` | `off`)
- `destroyDelay`: optional default destroy delay for units using this entity
- `cache`: optional cache defaults (`key`, `ttl`, `storage`)
- `readWrite`: optional strategy config (`batch`, `subview`, optional `adaptive`)
  - `adaptive: true` enables matrix-driven strategy selection based on cache/lru profile and operation class.
  - explicit `batch`/`subview` flags override adaptive values per field.

Entity mutation methods exposed to units:

- `upsertOne`, `upsertMany`
- `removeOne`, `removeMany`

Adaptive strategy helpers exported at package root:

- `resolveAdaptiveReadWriteProfileKey(...)`
- `resolveAdaptiveReadWriteConfig(...)`
- `resolveAdaptiveReadWriteByCache(...)`

### `source({ ... })`

- config: `entity`, optional `ttl`, `draft`, `cache`, `destroyDelay`, `onDestroy`, `defaultValue`, `update`, `run`
- unit from `source(scope)`:
  - `(payload?)` to set/reuse the next payload and return the same unit
  - `run(payload?)`
  - `force(payload?)`
  - `refetch(payload?)`
  - `reset()` (restores initial value/status/meta/context and clears stored payload)
  - `get`
  - `draft.set(...)`, `draft.clean()`
  - `effect`, `stop`, `destroy`

`source` is read-only at unit level: there is no direct `unit.set(...)`.

### `action({ ... })`

- config: `entity`, optional `destroyDelay`, `defaultValue`, `run`
- unit from `action(scope)`:
  - `(payload?)` to set/reuse the next payload and return the same unit
  - `run(payload?)`
  - `get`
  - `effect`, `stop`, `destroy`

### `stream({ ... })`

- config: `entity`, optional `destroyDelay`, `defaultValue`, `run`
- unit from `stream(scope)`:
  - `(payload?)` to set/reuse the next payload and return the same unit
  - `start(payload?)`
  - `get`
  - `effect`, `stop`, `destroy`

### `view({ ... })`

- config: `out`, optional `defaultValue`, `destroyDelay`
- unit from `view(scope)`:
  - `get()` -> snapshot
  - `effect`, `stop`, `destroy`

### `transform({ ... })`

- config: `out`, optional `in`, `defaultValue`, `destroyDelay`
- unit from `transform(scope)`:
  - `get()` -> snapshot
  - `set(payload)` -> executes `in(...)`
  - `effect`, `stop`, `destroy`

### Shared run context (`source` / `action` / `stream`)

- `scope`
- `payload`
- `setMeta`
- `getValue`
- `upsertOne`, `upsertMany`, `removeOne`, `removeMany`

Additional source-only run-context API:

- `reset()` restores source state to initial value/status/meta/context and clears current unit membership.

`run` may return a cleanup function for run-based units (`source`, `action`, `stream`).
That cleanup executes on `stop()`/`destroy()`.

## Advanced Tracking API (framework adapters)

`@livon/sync` also exports tracking helpers used by adapter packages:

- `subscribeTrackedUnit`
- `readTrackedUnitSnapshot`
- `resetTrackedUnit`

## Related pages

- [@livon/react](react)
- [Packages Overview](/docs/packages)
- [Architecture](/docs/technical/architecture)
