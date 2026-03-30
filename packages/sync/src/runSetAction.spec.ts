import { describe, expect, it, vi } from 'vitest';

import { action } from './action.js';
import { entity } from './entity.js';
import { source } from './source.js';
import type { SourceRunContext } from './source.js';
import { stream } from './stream.js';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
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

type ReadTodosRunContext = SourceRunContext<TodoIdentity, ReadTodosPayload, readonly Todo[]>;

const createTodoEntity = () => {
  return entity<Todo>({
    idOf: (value) => value.id,
  });
};

describe('run setAction inputs', () => {
  describe('happy', () => {
    it('should resolve source run input from direct setAction callback', async () => {
      const todoEntity = createTodoEntity();
      const runMock = vi.fn(async ({ identity, payload }: ReadTodosRunContext) => {
        return [
          {
            id: `${identity.listId}-${payload.query}`,
            title: payload.query,
            completed: false,
          },
        ];
      });

      const readTodos = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
        entity: todoEntity,
        defaultValue: [],
        run: runMock,
      });

      const unit = readTodos({
        listId: 'list-1',
      });

      await unit.run({ query: 'open' });

      const setActionMock = vi.fn((previous) => {
        expect(previous.snapshot.value[0]?.title).toBe('open');
        expect(previous.data).toEqual({ query: 'open' });
        return { query: 'mine' };
      });

      await unit.run(setActionMock, { mode: 'force' });

      expect(setActionMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          identity: { listId: 'list-1' },
          payload: { query: 'mine' },
        }),
      );
      expect(unit.getSnapshot().value[0]?.title).toBe('mine');
    });

    it('should resolve source run input from config setAction callback', async () => {
      const todoEntity = createTodoEntity();
      const runMock = vi.fn(async ({ payload }: ReadTodosRunContext) => {
        return [
          {
            id: payload.query,
            title: payload.query,
            completed: false,
          },
        ];
      });

      const readTodos = source<TodoIdentity, ReadTodosPayload, readonly Todo[]>({
        entity: todoEntity,
        defaultValue: [],
        run: runMock,
      });

      const unit = readTodos({
        listId: 'list-1',
      });

      await unit.run({ query: 'open' });

      await unit.run(() => undefined, { mode: 'refetch' });

      expect(runMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          payload: { query: 'open' },
        }),
      );
    });

    it('should resolve action run input from setAction callback', async () => {
      const todoEntity = createTodoEntity();
      const updateTodo = action<TodoIdentity, UpdateTodoPayload, Todo | null>({
        entity: todoEntity,
        run: async ({ payload }) => {
          return {
            id: payload.id,
            title: payload.title,
            completed: false,
          };
        },
        defaultValue: null,
      });

      const unit = updateTodo({
        listId: 'list-1',
      });

      await unit.run({
        id: 'todo-1',
        title: 'first',
      });

      const setActionMock = vi.fn((previous, config) => {
        expect(previous.snapshot.value?.title).toBe('first');
        expect(previous.data).toEqual({
          id: 'todo-1',
          title: 'first',
        });
        expect(config).toEqual({});
        return {
          id: 'todo-1',
          title: 'second',
        };
      });

      await unit.run(setActionMock, {});

      expect(setActionMock).toHaveBeenCalledTimes(1);
      expect(unit.getSnapshot().value?.title).toBe('second');
    });

    it('should resolve stream run input from setAction callback', async () => {
      const todoEntity = createTodoEntity();
      const onTodoChanged = stream<TodoIdentity, Todo, Todo | null>({
        entity: todoEntity,
        run: async ({ payload }) => {
          return payload;
        },
        defaultValue: null,
      });

      const unit = onTodoChanged({
        listId: 'list-1',
      });

      await unit.run({
        id: 'todo-1',
        title: 'first',
        completed: false,
      });

      await unit.run((previous, config) => {
        expect(previous.snapshot.value?.title).toBe('first');
        expect(config).toEqual({});
        return {
          id: 'todo-1',
          title: 'second',
          completed: false,
        };
      }, {});

      expect(unit.getSnapshot().value?.title).toBe('second');
    });
  });
});
