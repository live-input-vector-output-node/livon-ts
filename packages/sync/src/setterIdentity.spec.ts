import { describe, expect, it, vi } from 'vitest';

import { action } from './action.js';
import { entity } from './entity.js';
import { source } from './source.js';
import { stream } from './stream.js';
import { randomString } from './testing/randomData.js';

interface Todo {
  id: string;
  title: string;
}

interface TodoScope {
  listId: string;
}

describe('setter identity', () => {
  describe('sad', () => {
    it('should not trigger source effect when draft.set updater returns previous instance', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      const readTodo = source<TodoScope, Todo, Todo, Todo | null>({
        entity: todosEntity,
        run: async ({ payload, entity }) => {
          entity.upsertOne(payload);
        },
      });
      const unit = readTodo({ listId: randomString({ prefix: 'list-id' }) });
      const unitWithDraftApi = unit as unknown as {
        draft: {
          set: (input: Todo | ((previous: Todo | null) => Todo | null)) => void;
        };
      };
      const listener = vi.fn();
      const initialValue: Todo = {
        id: randomString({ prefix: 'todo-id' }),
        title: randomString({ prefix: 'todo-title' }),
      };

      unit.effect(listener);
      await unit.run(initialValue);
      unitWithDraftApi.draft.set(initialValue);
      listener.mockClear();
      unitWithDraftApi.draft.set((oldValue) => oldValue);

      expect(listener).toHaveBeenCalledTimes(0);
      expect(unit.get()).toBe(initialValue);
    });

    it('should not trigger action effect when set updater returns previous instance', () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      const updateTodo = action<TodoScope, Todo, Todo, Todo | null>({
        entity: todosEntity,
        run: async () => undefined,
      });
      const unit = updateTodo({ listId: randomString({ prefix: 'list-id' }) });
      const listener = vi.fn();
      const initialValue: Todo = {
        id: randomString({ prefix: 'todo-id' }),
        title: randomString({ prefix: 'todo-title' }),
      };

      unit.effect(listener);
      unit.set(initialValue);
      listener.mockClear();
      unit.set((oldValue) => oldValue);

      expect(listener).toHaveBeenCalledTimes(0);
      expect(unit.get()).toBe(initialValue);
    });

    it('should not trigger stream effect when set updater returns previous instance', () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      const todoChanged = stream<TodoScope, Todo, Todo, Todo | null>({
        entity: todosEntity,
        run: async () => undefined,
      });
      const unit = todoChanged({ listId: randomString({ prefix: 'list-id' }) });
      const listener = vi.fn();
      const initialValue: Todo = {
        id: randomString({ prefix: 'todo-id' }),
        title: randomString({ prefix: 'todo-title' }),
      };

      unit.effect(listener);
      unit.set(initialValue);
      listener.mockClear();
      unit.set((oldValue) => oldValue);

      expect(listener).toHaveBeenCalledTimes(0);
      expect(unit.get()).toBe(initialValue);
    });
  });
});
