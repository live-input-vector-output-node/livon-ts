import { describe, expect, it, vi } from 'vitest';

import { action } from './action.js';
import { entity } from './entity.js';
import { source } from './source.js';
import { transform } from './transform.js';
import { view } from './view.js';
import { randomString } from './testing/randomData.js';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodoScope {
  listId: string;
}

interface UpdateTodoTitlePayload {
  title: string;
}

interface Snapshot<TValue> {
  value: TValue;
  status: 'idle' | 'loading' | 'success' | 'error';
  meta: unknown;
  context: unknown;
}

describe('view() DX', () => {
  describe('happy', () => {
    it('should expose snapshot-style get and effect on view unit', () => {
      const readTodos = source<TodoScope, undefined, Todo, readonly Todo[]>({
        entity: entity<Todo>({
          idOf: (value) => value.id,
        }),
        run: async () => undefined,
        defaultValue: [],
      });

      const todoCountView = view<TodoScope, number>({
        out: async (rawContext: unknown) => {
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<readonly Todo[]>>;
          };
          const todosSnapshot = await context.get(readTodos(context.scope));
          return todosSnapshot.value.length;
        },
        defaultValue: 0,
      });

      const listId = randomString({ prefix: 'list-id' });
      const todoCountViewUnit = todoCountView({ listId }) as unknown as Record<string, unknown>;
      const readSnapshot = todoCountViewUnit.get as () => unknown;

      expect(typeof todoCountViewUnit.effect).toBe('function');
      expect(readSnapshot()).toEqual(
        expect.objectContaining({
          value: 0,
          status: 'idle',
        }),
      );
    });

    it('should recompute when source dependency emits a new snapshot', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const todoTitle = randomString({ prefix: 'todo-title' });

      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });

      const readTodos = source<TodoScope, undefined, Todo, readonly Todo[]>({
        entity: todosEntity,
        run: async ({ scope, entity }) => {
          entity.upsertMany([
            {
              id: `${scope.listId}:${todoId}`,
              title: todoTitle,
              completed: false,
            },
          ]);
        },
        defaultValue: [],
      });

      const todoCountView = view<TodoScope, number>({
        out: async (rawContext: unknown) => {
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<readonly Todo[]>>;
          };
          const todosSnapshot = await context.get(readTodos(context.scope));
          return todosSnapshot.value.length;
        },
        defaultValue: 0,
      });

      const todoCountViewUnitApi = todoCountView({ listId }) as unknown as Record<string, unknown>;

      expect(typeof todoCountViewUnitApi.effect).toBe('function');
      const todoCountViewUnit = todoCountView({ listId }) as unknown as {
        get: () => Snapshot<number>;
        effect: (listener: (snapshot: Snapshot<number>) => void) => void;
      };

      const receivedValues: number[] = [];
      todoCountViewUnit.effect((snapshot) => {
        receivedValues.push(snapshot.value);
      });

      await readTodos({ listId }).run();

      expect(todoCountViewUnit.get().value).toBe(1);
      expect(receivedValues).toContain(1);
    });
  });
});

describe('transform() DX', () => {
  describe('happy', () => {
    it('should expose snapshot-style get and effect on transform unit', () => {
      const todoTitleTransform = transform<TodoScope, UpdateTodoTitlePayload, string>({
        out: async () => '',
        in: async () => undefined,
        defaultValue: '',
      });

      const listId = randomString({ prefix: 'list-id' });
      const todoTitleTransformUnit = todoTitleTransform({ listId }) as unknown as Record<string, unknown>;
      const readSnapshot = todoTitleTransformUnit.get as () => unknown;

      expect(typeof todoTitleTransformUnit.effect).toBe('function');
      expect(readSnapshot()).toEqual(
        expect.objectContaining({
          value: '',
          status: 'idle',
        }),
      );
      expect(typeof todoTitleTransformUnit.set).toBe('function');
    });

    it('should use get in out and set in in with snapshot units', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const initialTitle = randomString({ prefix: 'initial-title' });
      const updatedTitle = randomString({ prefix: 'updated-title' });

      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });

      const readTodo = source<TodoScope, undefined, Todo, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, entity }) => {
          entity.upsertOne({
            id: `${scope.listId}:${todoId}`,
            title: initialTitle,
            completed: false,
          });
        },
      });

      const updateTodoRunMock = vi.fn(async ({ scope, payload, entity }) => {
        entity.upsertOne({
          id: `${scope.listId}:${todoId}`,
          title: payload.title,
          completed: false,
        });
      });

      const updateTodo = action<TodoScope, UpdateTodoTitlePayload, Todo, Todo | null>({
        entity: todosEntity,
        run: updateTodoRunMock,
      });

      const todoTitleTransform = transform<TodoScope, UpdateTodoTitlePayload, string>({
        out: async (rawContext: unknown) => {
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<Todo | null>>;
          };
          const todoSnapshot = await context.get(readTodo(context.scope));
          return todoSnapshot.value?.title ?? '';
        },
        in: async (rawContext: unknown) => {
          const context = rawContext as {
            payload: UpdateTodoTitlePayload;
            scope: TodoScope;
            set: (unit: unknown, payload: unknown) => Promise<unknown>;
          };
          await context.set(updateTodo(context.scope), context.payload);
        },
        defaultValue: '',
      });

      await readTodo({ listId }).run();
      const todoTitleTransformUnit = todoTitleTransform({ listId });

      await todoTitleTransformUnit.set({
        title: updatedTitle,
      });

      expect(updateTodoRunMock).toHaveBeenCalledTimes(1);
      expect(updateTodoRunMock).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            title: updatedTitle,
          },
          scope: {
            listId,
          },
        }),
      );
    });
  });
});
