import { describe, expect, it } from 'vitest';

import { action } from './action.js';
import { entity } from './entity.js';
import { source } from './source.js';
import { transform } from './transform.js';
import { randomString } from './testing/randomData.js';
import { view } from './view.js';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodoScope {
  listId: string;
}

interface TodoPayload {
  title: string;
}

interface UpdateTodoPayload {
  title: string;
}

interface MessageMeta {
  severity: 'info' | 'warning';
  text: string;
}

interface Snapshot<TValue> {
  value: TValue;
  status: 'idle' | 'loading' | 'success' | 'error';
  meta: unknown;
  context: unknown;
}

const waitForQueue = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('view() detail behavior', () => {
  describe('happy', () => {
    it('should propagate status and meta from dependency snapshots', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const todoTitle = randomString({ prefix: 'todo-title' });
      const sourceMeta: MessageMeta = {
        severity: 'info',
        text: randomString({ prefix: 'source-meta' }),
      };
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const readTodo = source<TodoScope, TodoPayload, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload, setMeta }) => {
          setMeta(sourceMeta);
          return {
            id: `${scope.listId}:${todoId}`,
            title: payload.title,
            completed: false,
          };
        },
      });
      const todoTitleView = view<TodoScope, string>({
        out: async (rawContext: unknown) => {
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<Todo | null>>;
          };
          const todoSnapshot = await context.get(readTodo(context.scope));
          return todoSnapshot.value?.title ?? '';
        },
        defaultValue: '',
      });
      const todoTitleViewUnit = todoTitleView({ listId }) as unknown as {
        get: () => Snapshot<string>;
        effect: (listener: (snapshot: Snapshot<string>) => void) => (() => void) | void;
      };
      const statuses: Array<'idle' | 'loading' | 'success' | 'error'> = [];
      const metas: unknown[] = [];

      todoTitleViewUnit.effect((snapshot) => {
        statuses.push(snapshot.status);
        metas.push(snapshot.meta);
      });

      await readTodo({ listId }).run({ title: todoTitle });

      expect(statuses).toContain('loading');
      expect(statuses).toContain('success');
      expect(metas).toContainEqual(sourceMeta);
      expect(todoTitleViewUnit.get().value).toBe(todoTitle);
    });

    it('should dedupe recompute for concurrent dependency updates', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const firstTodoId = randomString({ prefix: 'todo-id' });
      const secondTodoId = randomString({ prefix: 'todo-id' });
      const firstTitle = randomString({ prefix: 'todo-title' });
      const secondTitle = randomString({ prefix: 'todo-title' });
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const readTodoA = source<TodoScope, TodoPayload, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload }) => {
          return {
            id: `${scope.listId}:${firstTodoId}`,
            title: payload.title,
            completed: false,
          };
        },
      });
      const readTodoB = source<TodoScope, TodoPayload, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload }) => {
          return {
            id: `${scope.listId}:${secondTodoId}`,
            title: payload.title,
            completed: false,
          };
        },
      });
      let outCallCount = 0;

      const todoOverview = view<TodoScope, string>({
        out: async (rawContext: unknown) => {
          outCallCount += 1;
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<Todo | null>>;
          };
          const [leftSnapshot, rightSnapshot] = await Promise.all([
            context.get(readTodoA(context.scope)),
            context.get(readTodoB(context.scope)),
          ]);
          return `${leftSnapshot.value?.title ?? ''}|${rightSnapshot.value?.title ?? ''}`;
        },
        defaultValue: '',
      });
      const todoOverviewUnit = todoOverview({ listId }) as unknown as {
        effect: (listener: (snapshot: Snapshot<string>) => void) => (() => void) | void;
      };
      const remove = todoOverviewUnit.effect(() => undefined);

      outCallCount = 0;
      await Promise.all([
        readTodoA({ listId }).run({ title: firstTitle }),
        readTodoB({ listId }).run({ title: secondTitle }),
      ]);
      await waitForQueue();

      expect(outCallCount).toBe(1);
      remove?.();
    });
  });

  describe('sad', () => {
    it('should set error status when out throws', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const todoTitle = randomString({ prefix: 'todo-title' });
      const errorMessage = randomString({ prefix: 'view-out-error' });
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const readTodo = source<TodoScope, TodoPayload, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload }) => {
          return {
            id: `${scope.listId}:${todoId}`,
            title: payload.title,
            completed: false,
          };
        },
      });
      const failingView = view<TodoScope, string>({
        out: async () => {
          throw new Error(errorMessage);
        },
        defaultValue: '',
      });
      const failingViewUnit = failingView({ listId }) as unknown as {
        effect: (listener: (snapshot: Snapshot<string>) => void) => (() => void) | void;
      };
      const snapshots: Snapshot<string>[] = [];

      failingViewUnit.effect((snapshot) => {
        snapshots.push(snapshot);
      });

      await readTodo({ listId }).run({ title: todoTitle });
      await waitForQueue();

      const latestSnapshot = snapshots.at(-1);
      expect(latestSnapshot?.status).toBe('error');
      expect(latestSnapshot?.context).toEqual(
        expect.objectContaining({
          message: errorMessage,
        }),
      );
    });

    it('should unsubscribe from dependency updates when effect cleanup is called', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const firstTitle = randomString({ prefix: 'todo-title' });
      const secondTitle = randomString({ prefix: 'todo-title' });
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const readTodo = source<TodoScope, TodoPayload, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload }) => {
          return {
            id: `${scope.listId}:${todoId}`,
            title: payload.title,
            completed: false,
          };
        },
      });
      let outCallCount = 0;

      const todoTitleView = view<TodoScope, string>({
        out: async (rawContext: unknown) => {
          outCallCount += 1;
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<Todo | null>>;
          };
          const todoSnapshot = await context.get(readTodo(context.scope));
          return todoSnapshot.value?.title ?? '';
        },
        defaultValue: '',
      });
      const todoTitleViewUnit = todoTitleView({ listId }) as unknown as {
        effect: (listener: (snapshot: Snapshot<string>) => void) => (() => void) | void;
      };

      const remove = todoTitleViewUnit.effect(() => undefined);
      await readTodo({ listId }).run({ title: firstTitle });
      await waitForQueue();
      const outCallCountWithListener = outCallCount;

      remove?.();
      await readTodo({ listId }).run({ title: secondTitle });
      await waitForQueue();

      expect(outCallCount).toBe(outCallCountWithListener);
    });
  });
});

describe('transform() detail behavior', () => {
  describe('happy', () => {
    it('should propagate status and meta from dependency snapshots', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const todoTitle = randomString({ prefix: 'todo-title' });
      const sourceMeta: MessageMeta = {
        severity: 'warning',
        text: randomString({ prefix: 'source-meta' }),
      };
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const readTodo = source<TodoScope, TodoPayload, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload, setMeta }) => {
          setMeta(sourceMeta);
          return {
            id: `${scope.listId}:${todoId}`,
            title: payload.title,
            completed: false,
          };
        },
      });
      const todoTitleTransform = transform<TodoScope, UpdateTodoPayload, string>({
        out: async (rawContext: unknown) => {
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<Todo | null>>;
          };
          const todoSnapshot = await context.get(readTodo(context.scope));
          return todoSnapshot.value?.title ?? '';
        },
        in: async () => undefined,
        defaultValue: '',
      });
      const todoTitleTransformUnit = todoTitleTransform({ listId }) as unknown as {
        get: () => Snapshot<string>;
        effect: (listener: (snapshot: Snapshot<string>) => void) => (() => void) | void;
      };
      const statuses: Array<'idle' | 'loading' | 'success' | 'error'> = [];
      const metas: unknown[] = [];

      todoTitleTransformUnit.effect((snapshot) => {
        statuses.push(snapshot.status);
        metas.push(snapshot.meta);
      });

      await readTodo({ listId }).run({ title: todoTitle });

      expect(statuses).toContain('loading');
      expect(statuses).toContain('success');
      expect(metas).toContainEqual(sourceMeta);
      expect(todoTitleTransformUnit.get().value).toBe(todoTitle);
    });

    it('should dedupe recompute for concurrent dependency updates', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const firstTodoId = randomString({ prefix: 'todo-id' });
      const secondTodoId = randomString({ prefix: 'todo-id' });
      const firstTitle = randomString({ prefix: 'todo-title' });
      const secondTitle = randomString({ prefix: 'todo-title' });
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const readTodoA = source<TodoScope, TodoPayload, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload }) => {
          return {
            id: `${scope.listId}:${firstTodoId}`,
            title: payload.title,
            completed: false,
          };
        },
      });
      const readTodoB = source<TodoScope, TodoPayload, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload }) => {
          return {
            id: `${scope.listId}:${secondTodoId}`,
            title: payload.title,
            completed: false,
          };
        },
      });
      let outCallCount = 0;

      const todoOverviewTransform = transform<TodoScope, UpdateTodoPayload, string>({
        out: async (rawContext: unknown) => {
          outCallCount += 1;
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<Todo | null>>;
          };
          const [leftSnapshot, rightSnapshot] = await Promise.all([
            context.get(readTodoA(context.scope)),
            context.get(readTodoB(context.scope)),
          ]);
          return `${leftSnapshot.value?.title ?? ''}|${rightSnapshot.value?.title ?? ''}`;
        },
        in: async () => undefined,
        defaultValue: '',
      });
      const todoOverviewTransformUnit = todoOverviewTransform({ listId }) as unknown as {
        effect: (listener: (snapshot: Snapshot<string>) => void) => (() => void) | void;
      };
      const remove = todoOverviewTransformUnit.effect(() => undefined);

      outCallCount = 0;
      await Promise.all([
        readTodoA({ listId }).run({ title: firstTitle }),
        readTodoB({ listId }).run({ title: secondTitle }),
      ]);
      await waitForQueue();

      expect(outCallCount).toBe(1);
      remove?.();
    });
  });

  describe('sad', () => {
    it('should set error status when out throws', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const todoTitle = randomString({ prefix: 'todo-title' });
      const errorMessage = randomString({ prefix: 'transform-out-error' });
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const readTodo = source<TodoScope, TodoPayload, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload }) => {
          return {
            id: `${scope.listId}:${todoId}`,
            title: payload.title,
            completed: false,
          };
        },
      });
      const failingTransform = transform<TodoScope, UpdateTodoPayload, string>({
        out: async () => {
          throw new Error(errorMessage);
        },
        in: async () => undefined,
        defaultValue: '',
      });
      const failingTransformUnit = failingTransform({ listId }) as unknown as {
        effect: (listener: (snapshot: Snapshot<string>) => void) => (() => void) | void;
      };
      const snapshots: Snapshot<string>[] = [];

      failingTransformUnit.effect((snapshot) => {
        snapshots.push(snapshot);
      });

      await readTodo({ listId }).run({ title: todoTitle });
      await waitForQueue();

      const latestSnapshot = snapshots.at(-1);
      expect(latestSnapshot?.status).toBe('error');
      expect(latestSnapshot?.context).toEqual(
        expect.objectContaining({
          message: errorMessage,
        }),
      );
    });

    it('should set error status when in throws through context.set', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const errorMessage = randomString({ prefix: 'transform-in-error' });
      const todoId = randomString({ prefix: 'todo-id' });
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const updateTodo = action<TodoScope, UpdateTodoPayload, Todo | null>({
        entity: todosEntity,
        run: async () => {
          throw new Error(errorMessage);
        },
      });
      const todoTitleTransform = transform<TodoScope, UpdateTodoPayload, string>({
        out: async () => '',
        in: async (rawContext: unknown) => {
          const context = rawContext as {
            payload: UpdateTodoPayload;
            scope: TodoScope;
            set: (unit: unknown, payload: unknown) => Promise<unknown>;
          };
          await context.set(updateTodo(context.scope), context.payload);
        },
        defaultValue: '',
      });
      const todoTitleTransformUnit = todoTitleTransform({ listId }) as unknown as {
        set: (payload: UpdateTodoPayload) => Promise<void>;
        effect: (listener: (snapshot: Snapshot<string>) => void) => (() => void) | void;
      };
      const snapshots: Snapshot<string>[] = [];

      todoTitleTransformUnit.effect((snapshot) => {
        snapshots.push(snapshot);
      });

      await expect(
        todoTitleTransformUnit.set({
          title: randomString({ prefix: 'todo-title' }),
        }),
      ).rejects.toThrow(errorMessage);

      const latestSnapshot = snapshots.at(-1);
      expect(latestSnapshot?.status).toBe('error');
      expect(latestSnapshot?.context).toEqual(
        expect.objectContaining({
          message: errorMessage,
        }),
      );

      expect(todosEntity.getById(`${listId}:${todoId}`)).toBeUndefined();
    });

    it('should unsubscribe from dependency updates when effect cleanup is called', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const firstTitle = randomString({ prefix: 'todo-title' });
      const secondTitle = randomString({ prefix: 'todo-title' });
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const readTodo = source<TodoScope, TodoPayload, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload }) => {
          return {
            id: `${scope.listId}:${todoId}`,
            title: payload.title,
            completed: false,
          };
        },
      });
      let outCallCount = 0;

      const todoTitleTransform = transform<TodoScope, UpdateTodoPayload, string>({
        out: async (rawContext: unknown) => {
          outCallCount += 1;
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<Todo | null>>;
          };
          const todoSnapshot = await context.get(readTodo(context.scope));
          return todoSnapshot.value?.title ?? '';
        },
        in: async () => undefined,
        defaultValue: '',
      });
      const todoTitleTransformUnit = todoTitleTransform({ listId }) as unknown as {
        effect: (listener: (snapshot: Snapshot<string>) => void) => (() => void) | void;
      };

      const remove = todoTitleTransformUnit.effect(() => undefined);
      await readTodo({ listId }).run({ title: firstTitle });
      await waitForQueue();
      const outCallCountWithListener = outCallCount;

      remove?.();
      await readTodo({ listId }).run({ title: secondTitle });
      await waitForQueue();

      expect(outCallCount).toBe(outCallCountWithListener);
    });
  });
});
