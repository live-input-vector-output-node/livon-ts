<!-- Generated from website/docs/packages/*.md. Do not edit directly. -->

# @livon/react


[![npm](https://img.shields.io/npm/v/%40livon%2Freact)](https://www.npmjs.com/package/@livon/react)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Vulnerability scan](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Freact)](https://www.npmjs.com/package/@livon/react)

## Purpose

[@livon/react](https://livon.tech/docs/packages/react) is the React adapter for `@livon/sync` units.

Public hooks are intentionally minimal:

- `useLivonState(unit)` -> full snapshot
- `useLivonValue(unit)` -> `snapshot.value`
- `useLivonStatus(unit)` -> `snapshot.status`
- `useLivonMeta(unit)` -> `snapshot.meta`

Keep framework-agnostic behavior in `@livon/sync`; React-specific subscription/render integration stays in `@livon/react`.

## Install

```sh
pnpm add @livon/react @livon/sync
```

## Hooks

```ts
import {
  useLivonMeta,
  useLivonState,
  useLivonStatus,
  useLivonValue,
} from '@livon/react';
```

- `useLivonState(unit)` returns the complete unit snapshot, including unit-specific methods (`load`, `submit`, `start`, `refresh`, `apply`, `set`, `clear`, ...).
- `useLivonValue(unit)` subscribes only to value changes.
- `useLivonStatus(unit)` subscribes only to status changes.
- `useLivonMeta(unit)` subscribes only to meta changes.

Status values depend on unit type:
source/action/stream/view/transform use `idle | rehydrated | loading | refreshing | success | error`,
while draft uses `'dirty' | 'clear'`.

## Type Helpers

```ts
import type {
  LivonMetaOf,
  LivonSnapshotOf,
  LivonStateOf,
  LivonStatusOf,
  LivonValueOf,
} from '@livon/react';
```

Available helpers:

- `LivonSnapshotOf<TUnit>`
- `LivonValueOf<TUnit>`
- `LivonStatusOf<TUnit>`
- `LivonMetaOf<TUnit>`
- `LivonState<TValue, TStatus, TMeta>`
- `LivonStateOf<TUnit>`

## Shared Todo Setup

```ts
import { action, entity, source, transform, view } from '@livon/sync';

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
  idOf: ({ id }) => id,
});

const readTodos = source({
  entity: todoEntity,
  mode: 'many',
})<TodoIdentity, ReadTodosPayload>({
  defaultValue: [],
  run: async ({ identity: { listId }, payload: { query }, upsertMany }) => {
    const todos = await api.readTodos({
      listId,
      query,
    });

    upsertMany(todos, { merge: true });
  },
});

const updateTodo = action({
  entity: todoEntity,
  mode: 'one',
})<TodoIdentity, UpdateTodoPayload>({
  defaultValue: null,
  run: async ({ identity: { listId }, payload: { id, title }, upsertOne }) => {
    const updated = await api.updateTodo({ listId, id, title });
    upsertOne(updated, { merge: true });
  },
});

const todoStatsView = view<TodoIdentity, { total: number; open: number }>({
  defaultValue: { total: 0, open: 0 },
  out: async ({ identity, get }) => {
    const { value: todos } = await get(readTodos(identity));
    return {
      total: todos.length,
      open: todos.filter(({ completed }) => !completed).length,
    };
  },
});

const renameFirstTodo = transform<TodoIdentity, { title: string }, string>({
  defaultValue: '',
  out: async ({ identity, get }) => {
    const { value: todos } = await get(readTodos(identity));
    return todos[0]?.title ?? '';
  },
  in: async ({ identity, payload: { title }, get, set }) => {
    const { value: todos } = await get(readTodos(identity));
    const first = todos[0];
    if (!first) {
      return;
    }

    await set(updateTodo(identity), {
      id: first.id,
      title,
    });
  },
});
```

## Examples

### `useLivonState`

```ts
const todoListUnit = readTodos({ listId: 'list-1' });
const { load, refetch, value } = useLivonState(todoListUnit);

void load({ query: 'open' });
void refetch();
```

### `useLivonState` with `view`

```ts
const todoStatsUnit = todoStatsView({ listId: 'list-1' });
const {
  value: stats,
  status: statsStatus,
  refresh: refreshStats,
} = useLivonState(todoStatsUnit);

void refreshStats();
```

### `useLivonState` with `transform`

```ts
const renameUnit = renameFirstTodo({ listId: 'list-1' });
const {
  value: firstTodoTitle,
  apply: applyRename,
} = useLivonState(renameUnit);

void applyRename({ title: `${firstTodoTitle} (renamed)` });
```

### `useLivonValue`

```ts
const todos = useLivonValue(readTodos({ listId: 'list-1' }));
```

### `useLivonStatus`

```ts
const status = useLivonStatus(readTodos({ listId: 'list-1' }));
```

### `useLivonMeta`

```ts
const meta = useLivonMeta(readTodos({ listId: 'list-1' }));
```

## Listener Lifecycle

`useLivonValue`, `useLivonStatus`, and `useLivonMeta` are selective subscriptions.
A subscribe trigger does not force re-render when the selected slice did not change.
Initial render state always comes from `unit.getSnapshot()`.

## Related pages

- [@livon/sync](https://livon.tech/docs/packages/sync)
- [Packages Overview](https://livon.tech/docs/packages)
- [Architecture](https://livon.tech/docs/technical/architecture)
