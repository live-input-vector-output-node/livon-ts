---
title: "@livon/react"
sidebar_position: 9
---

[![npm](https://img.shields.io/npm/v/%40livon%2Freact)](https://www.npmjs.com/package/@livon/react)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Freact?label=dependencies)](https://libraries.io/npm/%40livon%2Freact)
[![npm publish](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/publish.yml?branch=main&label=npm%20publish)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/publish.yml)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![Snyk security](https://snyk.io/test/npm/@livon/react/badge.svg)](https://snyk.io/test/npm/@livon/react)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Freact?label=package%20size)](https://www.npmjs.com/package/@livon/react)
[![license](https://img.shields.io/npm/l/%40livon%2Freact)](https://www.npmjs.com/package/@livon/react)

## Purpose

[@livon/react](/docs/packages/react) is the React framework adapter for `@livon/sync` units.
It provides:

- atomic hooks for focused read/write concerns,
- grouped hooks for common unit workflows with lower boilerplate.

Keep framework-agnostic state and lifecycle behavior in `@livon/sync`; keep React integration here.

## Install

```sh
pnpm add @livon/react @livon/sync
```

## Atomic Hooks

```ts
import {
  useLivonMeta,
  useLivonRun,
  useLivonStatus,
  useLivonValue,
} from '@livon/react';
```

- `useLivonValue(unit)` -> `snapshot.value`
- `useLivonStatus(unit)` -> `idle | loading | success | error`
- `useLivonMeta(unit)` -> `snapshot.meta`
- `useLivonRun(unit)` -> calls `run(...)`

## Grouped Hooks

```ts
import {
  useLivonActionState,
  useLivonSourceState,
  useLivonState,
  useLivonStreamState,
} from '@livon/react';
```

- `useLivonState(unit)` -> `{ value, status, meta }`
- `useLivonSourceState(sourceUnit)` -> `{ value, status, meta, run }`
- `useLivonActionState(actionUnit)` -> `{ value, status, meta, run }`
- `useLivonStreamState(streamUnit)` -> `{ value, status, meta, run }`

## Shared Todo Setup

```ts
import { action, entity, source, stream } from '@livon/sync';

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
  draft: 'global',
});

const readTodos = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
  entity: todoEntity,
  defaultValue: [],
  run: async ({ identity, payload, entity }) => {
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

const onTodoChanged = stream<TodoIdentity, undefined, null>({
  entity: todoEntity,
  run: async ({ identity }) => {
    return api.subscribeTodoEvents({
      listId: identity.listId,
      onEvent: (event) => {
        if (event.type !== 'changed') {
          return;
        }

        const todoListUnit = readTodos(identity);
        void todoListUnit.run(undefined, { mode: 'refetch' });
      },
    });
  },
});
```

## Single Hook Examples

### `useLivonValue`

Use this when the component only needs the current data value (`snapshot.value`).
It is the minimal read hook for render output.

```ts
const unit = readTodos({ listId: 'list-1' });
const todos = useLivonValue(unit);
```

### `useLivonStatus`

Use this when the component should react to request/subscription lifecycle state.
Possible values are `idle`, `loading`, `success`, `error`.

```ts
const unit = readTodos({ listId: 'list-1' });
const status = useLivonStatus(unit);
```

### `useLivonMeta`

Use this to read custom metadata set from `run` via `setMeta(...)`.
Typical use cases: UI hints, messages, request diagnostics.

```ts
const unit = readTodos({ listId: 'list-1' });
const meta = useLivonMeta(unit);
```

### `useLivonRun`

Use this to trigger execution:

- `source` / `action` / `stream`: calls `run(...)`

```ts
const unit = readTodos({ listId: 'list-1' });
const run = useLivonRun(unit);
void run({ query: 'open' });
```

## Group Hook Examples

### `useLivonState`

```ts
const { value, status, meta } = useLivonState(readTodos({ listId: 'list-1' }));
```

### `useLivonSourceState`

```ts
const { run: loadTodoList } = useLivonSourceState(readTodos({ listId: 'list-1' }));
void loadTodoList({ payload: { query: 'open' } });
```

### `useLivonActionState`

```ts
const { run: updateTodoList } = useLivonActionState(updateTodo({ listId: 'list-1' }));

void updateTodoList({
  id: 'todo-1',
  title: 'Renamed from action state',
});
```

### `useLivonStreamState`

```ts
const { run: runTodoStream } = useLivonStreamState(onTodoChanged({ listId: 'list-1' }));
runTodoStream();
```

## Combined Example

```ts
import {
  useLivonActionState,
  useLivonSourceState,
  useLivonStreamState,
} from '@livon/react';
import { useEffect } from 'react';

export const TodoListScreen = ({ listId }: { listId: string }) => {
  const {
    value: todoList,
    status: todoListStatus,
    meta: todoListMeta,
    run: loadTodoList,
  } = useLivonSourceState(readTodos({ listId }));
  const {
    status: todoUpdateStatus,
    run: updateTodoList,
  } = useLivonActionState(updateTodo({ listId }));
  const { status: todoStreamStatus, run: runTodoStream } = useLivonStreamState(onTodoChanged({ listId }));

  useEffect(() => {
    void loadTodoList({ payload: { query: 'open' } });
    void runTodoStream();
  }, [loadTodoList, runTodoStream]);

  const onRenameFirstTodo = () => {
    const firstTodo = todoList[0];
    if (!firstTodo) {
      return;
    }

    void updateTodoList({
      id: firstTodo.id,
      title: `${firstTodo.title} (renamed)`,
    });
  };
  return {
    todos: todoList,
    todosStatus: todoListStatus,
    todosMeta: todoListMeta,
    updateStatus: todoUpdateStatus,
    streamStatus: todoStreamStatus,
    onRenameFirstTodo,
  };
};
```

## Listener Lifecycle

`useLivonValue`, `useLivonStatus`, and `useLivonMeta` subscribe through a shared tracked-unit counter.
Grouped hooks are built from these primitives and follow the same lifecycle behavior.
Subscriptions are driven by unit-level `subscribe(...)` callbacks and `getSnapshot()` reads.
`subscribe(...)` does not emit an initial snapshot; initial render state comes from `getSnapshot()`.

## Related pages

- [@livon/sync](sync)
- [Packages Overview](/docs/packages)
- [Architecture](/docs/technical/architecture)
