<!-- Generated from website/docs/packages/*.md. Do not edit directly. -->

# @livon/sync


[![npm](https://img.shields.io/npm/v/%40livon%2Fsync)](https://www.npmjs.com/package/@livon/sync)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Snyk security](https://snyk.io/test/npm/@livon/sync/badge.svg)](https://snyk.io/test/npm/@livon/sync)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fsync)](https://www.npmjs.com/package/@livon/sync)

## Purpose

[@livon/sync](https://livon.tech/docs/packages/sync) is the core sync layer for entity-centric state with three unit types:

- `source` for reads
- `action` for writes
- `stream` for realtime subscriptions

It also provides:

- `view` for read-only derived units
- `transform` for derived read/write units

All units now follow one minimal unit API surface:

- `getSnapshot()`
- `subscribe((snapshot) => ...)`

Execution triggers are unit-specific snapshot capabilities:

- `source`: `snapshot.load(...)`, `snapshot.refetch(...)`, `snapshot.force(...)`
- `action`: `snapshot.submit(...)`
- `stream`: `snapshot.start(...)`, `snapshot.stop()`
- `draft`: `snapshot.set(...)`, `snapshot.clear()`, `snapshot.reset()`

`@livon/sync` is framework-agnostic and consumed by adapters such as `@livon/react`.

## Install

```sh
pnpm add @livon/sync
```

## Core DX

`source`, `action`, and `stream` use an entity/mode builder signature:

- first call: `unit({ entity, mode })`
- second call: `(...)(config)`

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
  key: 'todo-entity',
  idOf: (value) => value.id,
  ttl: 30_000,
  destroyDelay: 250,
});

const readTodos = source({
  entity: todoEntity,
  mode: 'many',
})<TodoIdentity, ReadTodosPayload>({
  key: 'read-todos',
  ttl: 60_000,
  defaultValue: [],
  run: async ({ identity: { listId }, payload: { query }, setMeta, upsertMany }) => {
    setMeta({ request: 'loading-todos' });
    const todos = await api.readTodos({ listId, query });

    upsertMany(todos, { merge: true });
  },
});

const updateTodo = action({
  entity: todoEntity,
  mode: 'one',
})<TodoIdentity, UpdateTodoPayload>({
  key: 'update-todo',
  run: async ({ identity: { listId }, payload: { id, title }, upsertOne }) => {
    const updated = await api.updateTodo({
      id,
      listId,
      title,
    });

    upsertOne(updated, { merge: true });
  },
});

const onTodoEvents = stream({
  entity: todoEntity,
  mode: 'one',
})<TodoIdentity, undefined>({
  key: 'todo-events',
  run: async ({ identity: { listId } }) => {
    return api.subscribeTodoEvents({
      listId,
      onEvent: (event) => {
        if (event.type !== 'changed') {
          return;
        }

        // Source stays read-only; stream triggers explicit source refetch.
        const todoListUnit = readTodos({ listId });
        void todoListUnit.getSnapshot().refetch();
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

`identity` defines unit identity. Execution is triggered via snapshot capability methods (for example `load/submit/start`).

- Same `identity` => same unit/store instance
- Different `identity` => different unit/store instance

### Shared store with different executions

Use source `load(payload)` when all consumers should share one store:

```ts
const todoListUnit = readTodos({ listId: 'list-1' });

await todoListUnit.getSnapshot().load({ query: 'open' });
await todoListUnit.getSnapshot().load({ query: 'mine' });

// same unit, same shared store, latest load updates that store
```

### Separate stores per search result

Put search into `identity` when each search result needs its own store:

```ts
interface TodoSearchIdentity {
  listId: string;
  query: string;
}

const readTodosByIdentity = source({
  entity: todoEntity,
  mode: 'many',
})<TodoSearchIdentity, undefined>({
  key: 'read-todos-by-identity',
  defaultValue: [],
  run: async ({ identity, upsertMany }) => {
    const todos = await api.readTodos(identity);
    upsertMany(todos);
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

await todoListUnit.getSnapshot().load({ query: 'open' });
await todoListUnit.getSnapshot().refetch();
await todoListUnit.getSnapshot().force({ query: 'mine' });
await todoListUnit.getSnapshot().force(
  (previous) => ({
    query: previous.snapshot.value.length === 0 ? 'open' : 'mine',
  }),
);

const todoListSnapshot = todoListUnit.getSnapshot();
const todoList = todoListSnapshot.value;
const todoListIdentity = todoListSnapshot.identity;

await updateTodoUnit.getSnapshot().submit({
  id: todoList[0].id,
  title: 'Updated title',
});

await todoEventsUnit.getSnapshot().start();

const todoCountSnapshot = todoCountViewUnit.getSnapshot();
await todoCountSnapshot.refresh();

const { apply: applyTodoTitle } = todoTitleTransformUnit.getSnapshot();
await applyTodoTitle({
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

## Run Context Base

All `run` contexts now expose one shared base surface first:

- `identity`
- `value`
- `status`
- `meta`
- `context`

Then each unit adds only the methods that make sense for its use case (`set/reset` for `source`, mutation helpers for `action/stream`, and draft-specific methods for `draft`).

## Adaptive Read/Write

`@livon/sync` always resolves the best strategy automatically per operation (`readOne`, `readMany`, `updateOne`, `updateMany`, `setOne`, `setMany`) based on cache/lru profile and benchmark matrix.
You can still set explicit `readWrite.batch` or `readWrite.subview` values to override auto behavior per field.

## Lazy loading

`@livon/sync` loads `source` / `action` / `stream` lazily by default.
There is no separate public direct/eager mode entrypoint and no lazy subpath entrypoint.

```ts
import { action, entity, preload, source, stream } from '@livon/sync';

await preload();
```

- `configureLazy({ warmupOnFirstRun?: boolean })` to warm module loading early.
- `preload({ source?: boolean; action?: boolean; stream?: boolean })` to prefetch lazy modules explicitly.

## `view` and `transform`

- `view` is read-only and recomputes from dependencies accessed via `get(...)`.
- `transform` has `out` (read) and optional `in` (write). Its snapshot exposes `apply(...)` for write execution.
- In both units, `getSnapshot()` returns a full snapshot (`value`, `status`, `meta`, `context`), not only raw `value`.
- `view.refresh()` has no payload parameter; identity is bound when creating the unit (`view(identity)`).
- `transform.apply(payload)` takes the write payload and uses the bound identity from `transform(identity)`.

```ts
const todoStatsUnit = todoCount({ listId: 'list-1' });
const {
  value: todoCountValue,
  refresh: refreshTodoCount,
} = todoStatsUnit.getSnapshot();

await refreshTodoCount();

const todoRenameUnit = todoTitleTransform({ listId: 'list-1' });
const { apply: renameTodoTitle } = todoRenameUnit.getSnapshot();
await renameTodoTitle({
  id: 'todo-1',
  title: `${todoCountValue} todos loaded`,
});
```

## Structured Value Support

`@livon/sync` uses `msgpackr` with latin1 string encoding for identity/payload key serialization.
Identity and payload inputs must be msgpack-serializable.
Source cache now uses a two-layer cache:

- L1: in-memory `Map` (hot path reads)
- L2: `IndexedDB` (batched async reads/writes via microtask queue)

Source cache records are stored as native structured values in `IndexedDB` (no payload serialization). Only cache keys are serialized.
The cache-key contract is:

- `entity.key` + `source.key` + `entityMode` + serialized `identity`
- `source.key` is a required `string` (same for `action.key` and `stream.key`)

If `IndexedDB` fails at runtime, source cache enters staged retry/reconnect mode.
After retry budget is exhausted (or for permanent environment errors), cache is disabled (`cacheState: 'disabled'`) and sync continues without cache writes/rehydration.

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

- `key`: required unique entity namespace key
- `idOf`: required id extractor
- `ttl`: optional entity ttl fallback
- `cache`: optional cache defaults (`ttl`, `lruMaxEntries`)
  - source cache uses LRU by default (`lruMaxEntries: 256`).
  - set `lruMaxEntries: 0` to disable LRU explicitly.
  - cache backend is fixed to `IndexedDB` (L1 `Map` + L2 `IndexedDB`).
- `readWrite`: optional strategy config (`batch`, `subview`)
  - automatic matrix-driven strategy selection is always active.
  - explicit `batch`/`subview` flags override automatic values per field.

Entity mutation methods exposed to units:

- `upsertOne`, `upsertMany`
- `deleteOne`, `deleteMany`

### `source({ ... })`

- builder: `source({ entity, mode })`
  - `mode: 'one' | 'many'` defines source result shape from entity type (`one => Entity | null`, `many => readonly Entity[]`).
- config: required `key`, optional `ttl`, `cache`, `destroyDelay`, `defaultValue`, `run`
  - `run(context)` returns `void`/cleanup (or `Promise<void | cleanup>`).
  - when cache is enabled, cache namespace is always built from `entity.key` + `source.key`.
- unit from `source(identity)`:
  - `getSnapshot()`
    - `load(data?, config?)`
    - `load(setAction, config?)`
    - `refetch(input?)`
    - `force(input?)`
  - `subscribe(listener)`

### `draft({ ... })`

- factory: `draft({ entity, mode })` returns a config builder
- config: required `key`, optional `mode`, `ttl`, `cache`, `destroyDelay`, `defaultValue`, `run`
  - `mode` controls overlay visibility and defaults to `'global'`:
    - `'local'`: only this draft unit identity instance sees the overlay.
    - `'identity'`: units with the same identity see the overlay.
    - `'global'`: all units that contain the same entity id see the overlay.
- draft state is owned by `draft` (not by `entity`).
- per entity id, draft ownership is locked to the first identity that marks it dirty.
- foreign identity draft writes are queued and merged after owner clear.
- unit from `draft(identity)`:
  - `getSnapshot()` returns `{ value, status, meta, context, identity, set, clear, reset }`
    - `status` is draft-only: `'dirty' | 'clear'`
    - `set(next | updater)` updates draft overlay only
    - `clear()` clears draft overlay entries for the unit identity and selected draft visibility mode
    - `reset()` alias for `clear()`
  - `subscribe(listener)`

### `action({ ... })`

- builder: `action({ entity, mode })`
  - `mode: 'one' | 'many'` defines action result shape from entity type (`one => Entity | null`, `many => readonly Entity[]`).
- config: required `key`, optional `defaultValue`, `run`
  - `run(context)` returns `void`/cleanup (or `Promise<void | cleanup>`).
- unit from `action(identity)`:
  - `getSnapshot()`
    - `submit(data?, config?)`
    - `submit(setAction, config?)`
  - `subscribe(listener)`

### `stream({ ... })`

- builder: `stream({ entity, mode })`
  - `mode: 'one' | 'many'` defines stream result shape from entity type (`one => Entity | null`, `many => readonly Entity[]`).
- config: required `key`, optional `defaultValue`, `run`
  - `run(context)` returns `void`/cleanup (or `Promise<void | cleanup>`).
- unit from `stream(identity)`:
  - `getSnapshot()`
    - `start(data?, config?)`
    - `start(setAction, config?)`
    - `stop()`
  - `subscribe(listener)`

### `view({ ... })`

- config: `out`, optional `defaultValue`
- unit from `view(identity)`:
  - `getSnapshot()`
    - `refresh()`
  - `subscribe(listener)`

### `transform({ ... })`

- config: `out`, optional `in`, `defaultValue`
- unit from `transform(identity)`:
  - `getSnapshot()`
    - `apply(payload)` -> executes `in(...)`
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

Source-only fields (`source` config `run(context)`):

- `set(nextValue | ((previousValue) => nextValue))`: hard-replaces source state for the active run and updates membership accordingly, including removing entries not present in the next value.
- `reset()`: restores source state to initial value/status/meta/context and clears current unit membership.

Draft-only fields (`draft` config `run(context)`):

- includes source mutation fields (`upsertOne`, `upsertMany`, `deleteOne`, `deleteMany`, `getValue`, `reset`) plus draft run helpers:
- `set(nextValue | ((previousValue) => nextValue))`: updates unit value inside run
- `clear()`: clears draft overlay entries for this unit identity

### Snapshot Context Typing

`source` snapshots expose typed runtime context:

- `context`: `SourceContext`
- `SourceContext.cacheState`: `'disabled' | 'miss' | 'hit' | 'stale'`
- `SourceContext.error`: `unknown`

```ts
const todoListSnapshot = readTodos({ listId: 'list-1' }).getSnapshot();
const cacheState = todoListSnapshot.context.cacheState;
const cacheError = todoListSnapshot.context.error;
```

`action` and `stream` snapshot `context` remain `unknown` by default.
`draft` snapshots keep `SourceContext`, but `status` is `'dirty' | 'clear'`.

Action-only notes (`action` config `run(context)`):

- no `set(...)`.
- no `reset()`.

Stream-only notes (`stream` config `run(context)`):

- no `set(...)`.
- no `reset()`.

## Advanced Tracking API (framework adapters)

`@livon/sync` also exports tracking helpers used by adapter packages:

- `subscribeTrackedUnit`
- `readTrackedUnitSnapshot`
- `resetTrackedUnit`

## Related pages

- [@livon/react](https://livon.tech/docs/packages/react)
- [Packages Overview](https://livon.tech/docs/packages)
- [Architecture](https://livon.tech/docs/technical/architecture)
