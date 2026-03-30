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

- `source` for reads
- `action` for writes
- `stream` for realtime subscriptions

It also provides:

- `view` for read-only derived units
- `transform` for derived read/write units

All units now follow one minimal runtime API surface:

- `run(...)`
- `getSnapshot()`
- `subscribe((snapshot) => ...)`

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

interface TodoIdentity {
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

const readTodos = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
  entity: todoEntity,
  ttl: 60_000,
  defaultValue: [],
  run: async ({ identity, payload, setMeta, entity }) => {
    setMeta({ request: 'loading-todos' });
    const todos = await api.readTodos({
      listId: identity.listId,
      query: payload.query,
    });

    entity.upsertMany(todos, { merge: true });
  },
});

const updateTodo = action<TodoIdentity, UpdateTodoPayload, Todo | null>({
  entity: todoEntity,
  run: async ({ identity, payload, entity }) => {
    const updated = await api.updateTodo({
      id: payload.id,
      listId: identity.listId,
      title: payload.title,
    });

    entity.upsertOne(updated, { merge: true });
  },
});

const onTodoEvents = stream<TodoIdentity, undefined, null>({
  entity: todoEntity,
  run: async ({ identity }) => {
    return api.subscribeTodoEvents({
      listId: identity.listId,
      onEvent: (event) => {
        if (event.type !== 'changed') {
          return;
        }

        // Source stays read-only; stream triggers explicit source run.
        const todoListUnit = readTodos({ listId: identity.listId });
        void todoListUnit.run(undefined, { mode: 'refetch' });
      },
      onError: () => {
        return;
      },
    });
  },
});

const todoCount = view<TodoIdentity, number>({
  defaultValue: 0,
  out: async ({ identity, get }) => {
    const todosSnapshot = await get(readTodos(identity));
    return todosSnapshot.value.length;
  },
});

const todoTitleTransform = transform<TodoIdentity, UpdateTodoPayload, string>({
  defaultValue: '',
  out: async ({ identity, get }) => {
    const todosSnapshot = await get(readTodos(identity));
    return todosSnapshot.value[0]?.title ?? '';
  },
  in: async ({ identity, payload, set }) => {
    await set(updateTodo(identity), payload);
  },
});
```

## Unit Identity Rule

`identity` defines unit identity. `run(payload)` defines execution.

- Same `identity` => same unit/store instance
- Different `identity` => different unit/store instance

### Shared store with different executions

Use `run(payload)` when all consumers should share one store:

```ts
const todoListUnit = readTodos({ listId: 'list-1' });

await todoListUnit.run({ query: 'open' });
await todoListUnit.run({ query: 'mine' });

// same unit, same shared store, latest run updates that store
```

### Separate stores per search result

Put search into `identity` when each search result needs its own store:

```ts
interface TodoSearchIdentity {
  listId: string;
  query: string;
}

const readTodosByIdentity = source<TodoSearchIdentity, undefined, readonly Todo[]>({
  entity: todoEntity,
  defaultValue: [],
  run: async ({ identity, entity }) => {
    const todos = await api.readTodos(identity);
    entity.upsertMany(todos);
  },
});

const openUnit = readTodosByIdentity({ listId: 'list-1', query: 'open' });
const mineUnit = readTodosByIdentity({ listId: 'list-1', query: 'mine' });

// different identities => different stores
```

## Runtime Usage

```ts
const todoListUnit = readTodos({ listId: 'list-1' });
const updateTodoUnit = updateTodo({ listId: 'list-1' });
const todoEventsUnit = onTodoEvents({ listId: 'list-1' });
const todoCountViewUnit = todoCount({ listId: 'list-1' });
const todoTitleTransformUnit = todoTitleTransform({ listId: 'list-1' });

await todoListUnit.run({ query: 'open' });
await todoListUnit.run(undefined, { mode: 'refetch' });
await todoListUnit.run({ query: 'mine' }, { mode: 'force' });
await todoListUnit.run(
  (previous) => ({
    query: previous.snapshot.value.length === 0 ? 'open' : 'mine',
  }),
  { mode: 'force' },
);

const todoListSnapshot = todoListUnit.getSnapshot();
const todoList = todoListSnapshot.value;

await updateTodoUnit.run({
  id: todoList[0].id,
  title: 'Updated title',
});

await todoEventsUnit.run();

const todoCountSnapshot = todoCountViewUnit.getSnapshot();
await todoTitleTransformUnit.run({
  id: todoList[0].id,
  title: 'From transform',
});
const todoTitleSnapshot = todoTitleTransformUnit.getSnapshot();

const removeListener = todoListUnit.subscribe((snapshot) => {
  console.log(snapshot.status, snapshot.meta, snapshot.context);
});

// subscribe emits only on changes; read initial state via getSnapshot()
console.log(todoListUnit.getSnapshot());

removeListener?.();
```

## `view` and `transform`

- `view` is read-only and recomputes from dependencies accessed via `get(...)`.
- `transform` has `out` (read) and optional `in` (write). Its `run(...)` calls `in`.
- In both units, `getSnapshot()` returns a full snapshot (`value`, `status`, `meta`, `context`), not only raw `value`.

## Structured Value Support

`@livon/sync` uses `msgpackr` with latin1 string encoding for identity/payload key serialization and source cache rehydration.
Identity and payload inputs must be msgpack-serializable.

Round-trips preserve common non-JSON values such as:

- `Date`
- `BigInt`
- `undefined`
- `NaN`, `Infinity`, `-Infinity`, `-0`
- `RegExp`
- `Map`
- `Set`

Functions and symbols are not valid identity/payload values for key serialization.

## API Summary

### `entity({ ... })`

- `key`: required when any connected `source` uses cache
- `idOf`: required id extractor
- `ttl`: optional entity ttl fallback
- `draft`: optional draft mode (`global` | `scoped` | `off`)
- `cache`: optional cache defaults (`ttl`, `storage`, `lruMaxEntries`)
  - source cache uses LRU by default (`lruMaxEntries: 256`).
  - set `lruMaxEntries: 0` to disable LRU explicitly.
- `readWrite`: optional strategy config (`batch`, `subview`, optional `adaptive`)
  - `adaptive: true` enables matrix-driven strategy selection based on cache/lru profile and operation class.
  - explicit `batch`/`subview` flags override adaptive values per field.

Entity mutation methods exposed to units:

- `upsertOne`, `upsertMany`
- `deleteOne`, `deleteMany`

Adaptive strategy helpers exported at package root:

- `resolveAdaptiveReadWriteProfileKey(...)`
- `resolveAdaptiveReadWriteConfig(...)`
- `resolveAdaptiveReadWriteByCache(...)`
- `resolveAdaptiveReadWriteByIntent(...)`

### `source({ ... })`

- config: `key`, `entity`, optional `ttl`, `draft`, `cache`, `onDestroy`, `defaultValue`, `run`
  - `run(context)` must return `void` or a cleanup function.
  - when cache is enabled, `entity.key` and `source.key` are required and form the cache namespace.
- unit from `source(identity)`:
  - `run(data?, config?)`
  - `run(setAction, config?)`
  - `getSnapshot()`
  - `subscribe(listener)`

### `action({ ... })`

- config: `entity`, optional `defaultValue`, `run`
  - `run(context)` must return `void` or a cleanup function.
- unit from `action(identity)`:
  - `run(data?, config?)`
  - `run(setAction, config?)`
  - `getSnapshot()`
  - `subscribe(listener)`

### `stream({ ... })`

- config: `entity`, optional `defaultValue`, `run`
  - `run(context)` must return `void` or a cleanup function.
- unit from `stream(identity)`:
  - `run(data?, config?)`
  - `run(setAction, config?)`
  - `getSnapshot()`
  - `subscribe(listener)`

### `view({ ... })`

- config: `out`, optional `defaultValue`
- unit from `view(identity)`:
  - `run()`
  - `getSnapshot()`
  - `subscribe(listener)`

### `transform({ ... })`

- config: `out`, optional `in`, `defaultValue`
- unit from `transform(identity)`:
  - `run(payload)` -> executes `in(...)`
  - `getSnapshot()`
  - `subscribe(listener)`

### Run context reference

`source`, `action`, and `stream` all receive a run context object.

Common fields available in all three contexts:

- `identity`: current unit identity.
- `payload`: current payload for this run.
- `setMeta(meta | ((previousMeta) => nextMeta))`: updates unit `meta`.
- `getValue()`: reads current unit value.
- `upsertOne(input, options?)`: upserts one entity and syncs unit membership.
- `upsertMany(input[], options?)`: upserts multiple entities and syncs unit membership.
- `deleteOne(id)`: removes one entity by id.
- `deleteMany(ids[])`: removes multiple entities by ids.

Source-only fields (`source(...).run(context)`):

- `set(nextValue | ((previousValue) => nextValue))`: hard-replaces source state for the active run and updates membership accordingly, including removing entries not present in the next value.
- `reset()`: restores source state to initial value/status/meta/context and clears current unit membership.

Action-only notes (`action(...).run(context)`):

- no `set(...)`.
- no `reset()`.

Stream-only notes (`stream(...).run(context)`):

- no `set(...)`.
- no `reset()`.

## Advanced Tracking API (framework adapters)

`@livon/sync` also exports tracking helpers used by adapter packages:

- `subscribeTrackedUnit`
- `readTrackedUnitSnapshot`
- `resetTrackedUnit`

## Related pages

- [@livon/react](react)
- [Packages Overview](/docs/packages)
- [Architecture](/docs/technical/architecture)
