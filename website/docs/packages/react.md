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
  useLivonDraft,
  useLivonMeta,
  useLivonRun,
  useLivonStatus,
  useLivonStop,
  useLivonValue,
} from '@livon/react';
```

- `useLivonValue(unit)` -> `snapshot.value`
- `useLivonStatus(unit)` -> `idle | loading | success | error`
- `useLivonMeta(unit)` -> `snapshot.meta`
- `useLivonRun(unit)` -> calls `run(...)` when available, otherwise `start(...)`
- `useLivonStop(unit)` -> calls `stop()`
- `useLivonDraft(sourceUnit)` -> `[setDraft, cleanDraft]` (maps to `sourceUnit.draft.set/clean`)

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
- `useLivonSourceState(sourceUnit)` -> `{ value, status, meta, run, refetch, force, reset, stop, draft }`
- `useLivonActionState(actionUnit)` -> `{ value, status, meta, run, stop }`
- `useLivonStreamState(streamUnit)` -> `{ value, status, meta, start, stop }`

## Shared Todo Setup

```ts
import { action, entity, source, stream } from '@livon/sync';

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
  draft: 'global',
});

const readTodos = source<TodoScope, ReadTodosPayload, readonly Todo[]>({
  entity: todoEntity,
  defaultValue: [],
  run: async ({ scope, payload, entity }) => {
    const todos = await api.readTodos({
      listId: scope.listId,
      query: payload.query,
    });
    entity.upsertMany(todos, { merge: true });
  },
});

const updateTodo = action<TodoScope, UpdateTodoPayload, Todo | null>({
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

const onTodoChanged = stream<TodoScope, undefined, null>({
  entity: todoEntity,
  run: async ({ scope }) => {
    return api.subscribeTodoEvents({
      listId: scope.listId,
      onEvent: (event) => {
        if (event.type !== 'changed') {
          return;
        }

        const todoListUnit = readTodos(scope);
        void todoListUnit.refetch();
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

- `source` / `action`: calls `run(...)`
- `stream`: calls `start(...)`

```ts
const unit = readTodos({ listId: 'list-1' });
const run = useLivonRun(unit);
void run({ query: 'open' });
```

### `useLivonStop`

Use this to stop current execution/cleanup for the unit.
Typical pattern: return it from `useEffect` cleanup.

```ts
const unit = readTodos({ listId: 'list-1' });
const stop = useLivonStop(unit);
stop();
```

### `useLivonDraft`

Use this only with `source` units to edit draft overlay state:

- `setDraft(...)` applies or updates draft values
- `cleanDraft()` clears the draft overlay

```ts
const unit = readTodos({ listId: 'list-1' });
const [setDraft, cleanDraft] = useLivonDraft(unit);

setDraft((previousTodos) => {
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
cleanDraft();
```

## Group Hook Examples

### `useLivonState`

```ts
const { value, status, meta } = useLivonState(readTodos({ listId: 'list-1' }));
```

### `useLivonSourceState`

```ts
const {
  run: loadTodoList,
  refetch: reloadTodoList,
  force: forceReloadTodoList,
  reset: resetTodoList,
  stop: abortTodoListLoad,
  draft: todoDraft,
} = useLivonSourceState(readTodos({ listId: 'list-1' }));
const { set: setTodoDraft, clean: cleanTodoDraft } = todoDraft;

void loadTodoList({ query: 'open' });
void reloadTodoList();
void forceReloadTodoList({ query: 'urgent' });
setTodoDraft((previousTodos) => previousTodos);
cleanTodoDraft();
resetTodoList();
abortTodoListLoad();
```

### `useLivonActionState`

```ts
const {
  run: updateTodoList,
  stop: abortTodoUpdate,
} = useLivonActionState(updateTodo({ listId: 'list-1' }));

void updateTodoList({
  id: 'todo-1',
  title: 'Renamed from action state',
});
abortTodoUpdate();
```

### `useLivonStreamState`

```ts
const {
  start: startTodoStream,
  stop: stopTodoStream,
} = useLivonStreamState(onTodoChanged({ listId: 'list-1' }));

startTodoStream();
stopTodoStream();
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
    reset: resetTodoList,
    stop: abortTodoListLoad,
    draft: todoDraft,
  } = useLivonSourceState(readTodos({ listId }));
  const { set: setTodoDraft, clean: clearTodoDraft } = todoDraft;
  const {
    status: todoUpdateStatus,
    run: updateTodoList,
    stop: abortTodoUpdate,
  } = useLivonActionState(updateTodo({ listId }));
  const {
    status: todoStreamStatus,
    start: startTodoStream,
    stop: stopTodoStream,
  } = useLivonStreamState(onTodoChanged({ listId }));

  useEffect(() => {
    void loadTodoList({ query: 'open' });
    startTodoStream();

    return () => {
      stopTodoStream();
      abortTodoListLoad();
      abortTodoUpdate();
    };
  }, [abortTodoListLoad, abortTodoUpdate, loadTodoList, startTodoStream, stopTodoStream]);

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

  const onDraftFirstTodo = () => {
    setTodoDraft((previousTodos) => {
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
  };

  return {
    todos: todoList,
    todosStatus: todoListStatus,
    todosMeta: todoListMeta,
    updateStatus: todoUpdateStatus,
    streamStatus: todoStreamStatus,
    onRenameFirstTodo,
    onDraftFirstTodo,
    onCleanDraft: clearTodoDraft,
    onResetTodoList: resetTodoList,
  };
};
```

## Listener Lifecycle

`useLivonValue`, `useLivonStatus`, and `useLivonMeta` subscribe through a shared tracked-unit counter.
Grouped hooks are built from these primitives and follow the same lifecycle behavior.
When the last listener for a unit unmounts, `stop()` is scheduled with unit `destroyDelay`.

Destroy delay precedence:

1. unit (`source`/`action`/`stream`) `destroyDelay`
2. entity `destroyDelay`
3. default `250`

## Related pages

- [@livon/sync](sync)
- [Packages Overview](/docs/packages)
- [Architecture](/docs/technical/architecture)
