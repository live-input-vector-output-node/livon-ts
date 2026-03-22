import { describe, expect, it } from 'vitest';

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

interface SourcePayload {
  mode: 'seed' | 'noop' | 'meta-update';
  title: string;
  messageText: string;
}

interface TodoMeta {
  severity: 'info';
  message: {
    text: string;
  };
}

interface Snapshot<TValue> {
  value: TValue;
  status: 'idle' | 'loading' | 'success' | 'error';
  meta: unknown;
  context: unknown;
}

interface TodoProjection {
  todo: Todo | null;
  meta: TodoMeta | null;
}

const waitForQueue = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('effect chain stability', () => {
  describe('sad', () => {
    it('should not emit downstream effects when upstream setMeta updater returns previous instance', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const readTodo = source<TodoScope, SourcePayload, Todo, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload, setMeta, entity }) => {
          if (payload.mode === 'seed') {
            setMeta({
              severity: 'info',
              message: {
                text: payload.messageText,
              },
            });
            entity.upsertOne({
              id: `${scope.listId}:${todoId}`,
              title: payload.title,
              completed: false,
            });
            return;
          }

          if (payload.mode === 'noop') {
            setMeta((oldMeta: unknown) => oldMeta);
            return;
          }

          setMeta((oldMeta: unknown) => {
            const parsedMeta = oldMeta as TodoMeta;
            return {
              ...parsedMeta,
              message: {
                ...parsedMeta.message,
                text: payload.messageText,
              },
            };
          });
        },
      });
      const todoProjectionView = view<TodoScope, TodoProjection>({
        out: async (rawContext: unknown) => {
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<Todo | null>>;
          };
          const todoSnapshot = await context.get(readTodo(context.scope));
          return {
            todo: todoSnapshot.value,
            meta: (todoSnapshot.meta as TodoMeta | null) ?? null,
          };
        },
        defaultValue: {
          todo: null,
          meta: null,
        },
      });
      const todoProjectionTransform = transform<TodoScope, SourcePayload, TodoProjection>({
        out: async (rawContext: unknown) => {
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<TodoProjection>>;
          };
          const projectionSnapshot = await context.get(todoProjectionView(context.scope));
          return projectionSnapshot.value;
        },
        in: async () => undefined,
        defaultValue: {
          todo: null,
          meta: null,
        },
      });
      const viewUnit = todoProjectionView({ listId }) as unknown as {
        get: () => Snapshot<TodoProjection>;
        effect: (listener: (snapshot: Snapshot<TodoProjection>) => void) => (() => void) | void;
      };
      const transformUnit = todoProjectionTransform({ listId }) as unknown as {
        get: () => Snapshot<TodoProjection>;
        effect: (listener: (snapshot: Snapshot<TodoProjection>) => void) => (() => void) | void;
      };
      let viewEmits = 0;
      let transformEmits = 0;

      viewUnit.effect(() => {
        viewEmits += 1;
      });
      transformUnit.effect(() => {
        transformEmits += 1;
      });

      await readTodo({ listId }).run({
        mode: 'seed',
        title: randomString({ prefix: 'todo-title' }),
        messageText: randomString({ prefix: 'message-text' }),
      });
      await waitForQueue();
      await waitForQueue();

      viewEmits = 0;
      transformEmits = 0;
      const viewSnapshotBeforeNoop = viewUnit.get();
      const snapshotBeforeNoop = transformUnit.get();
      await readTodo({ listId }).run({
        mode: 'noop',
        title: randomString({ prefix: 'todo-title' }),
        messageText: randomString({ prefix: 'message-text' }),
      });
      await waitForQueue();
      const viewSnapshotAfterNoop = viewUnit.get();
      const snapshotAfterNoop = transformUnit.get();

      expect(viewEmits).toBe(0);
      expect(transformEmits).toBe(0);
      expect(viewSnapshotAfterNoop).toBe(viewSnapshotBeforeNoop);
      expect(viewSnapshotAfterNoop.value).toBe(viewSnapshotBeforeNoop.value);
      expect(snapshotAfterNoop).toBe(snapshotBeforeNoop);
      expect(snapshotAfterNoop.value).toBe(snapshotBeforeNoop.value);
      expect(snapshotAfterNoop.value.meta).toBe(snapshotBeforeNoop.value.meta);
      expect(snapshotAfterNoop.value.todo).toBe(snapshotBeforeNoop.value.todo);
    });

    it('should keep unchanged references stable across chain on partial meta update', async () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });
      const readTodo = source<TodoScope, SourcePayload, Todo, Todo | null>({
        entity: todosEntity,
        run: async ({ scope, payload, setMeta, entity }) => {
          if (payload.mode === 'seed') {
            setMeta({
              severity: 'info',
              message: {
                text: payload.messageText,
              },
            });
            entity.upsertOne({
              id: `${scope.listId}:${todoId}`,
              title: payload.title,
              completed: false,
            });
            return;
          }

          if (payload.mode === 'noop') {
            setMeta((oldMeta: unknown) => oldMeta);
            return;
          }

          setMeta((oldMeta: unknown) => {
            const parsedMeta = oldMeta as TodoMeta;
            return {
              ...parsedMeta,
              message: {
                ...parsedMeta.message,
                text: payload.messageText,
              },
            };
          });
        },
      });
      const todoProjectionView = view<TodoScope, TodoProjection>({
        out: async (rawContext: unknown) => {
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<Todo | null>>;
          };
          const todoSnapshot = await context.get(readTodo(context.scope));
          return {
            todo: todoSnapshot.value,
            meta: (todoSnapshot.meta as TodoMeta | null) ?? null,
          };
        },
        defaultValue: {
          todo: null,
          meta: null,
        },
      });
      const todoProjectionTransform = transform<TodoScope, SourcePayload, TodoProjection>({
        out: async (rawContext: unknown) => {
          const context = rawContext as {
            scope: TodoScope;
            get: (unit: unknown) => Promise<Snapshot<TodoProjection>>;
          };
          const projectionSnapshot = await context.get(todoProjectionView(context.scope));
          return projectionSnapshot.value;
        },
        in: async () => undefined,
        defaultValue: {
          todo: null,
          meta: null,
        },
      });
      const viewUnit = todoProjectionView({ listId }) as unknown as {
        get: () => Snapshot<TodoProjection>;
        effect: (listener: (snapshot: Snapshot<TodoProjection>) => void) => (() => void) | void;
      };
      const transformUnit = todoProjectionTransform({ listId }) as unknown as {
        get: () => Snapshot<TodoProjection>;
        effect: (listener: (snapshot: Snapshot<TodoProjection>) => void) => (() => void) | void;
      };
      let viewEmits = 0;
      let transformEmits = 0;

      viewUnit.effect(() => {
        viewEmits += 1;
      });
      transformUnit.effect(() => {
        transformEmits += 1;
      });

      await readTodo({ listId }).run({
        mode: 'seed',
        title: randomString({ prefix: 'todo-title' }),
        messageText: randomString({ prefix: 'message-text' }),
      });
      await waitForQueue();
      await waitForQueue();
      await readTodo({ listId }).run({
        mode: 'seed',
        title: randomString({ prefix: 'todo-title' }),
        messageText: randomString({ prefix: 'message-text' }),
      });
      await waitForQueue();
      await waitForQueue();

      const viewSnapshotBeforeMetaUpdate = viewUnit.get();
      const snapshotBeforeMetaUpdate = transformUnit.get();
      const valueBeforeMetaUpdate = snapshotBeforeMetaUpdate.value;
      viewEmits = 0;
      transformEmits = 0;

      await readTodo({ listId }).run({
        mode: 'meta-update',
        title: randomString({ prefix: 'todo-title' }),
        messageText: randomString({ prefix: 'message-text' }),
      });
      await waitForQueue();

      const viewSnapshotAfterMetaUpdate = viewUnit.get();
      const snapshotAfterMetaUpdate = transformUnit.get();
      const valueAfterMetaUpdate = snapshotAfterMetaUpdate.value;

      expect(viewEmits).toBe(1);
      expect(transformEmits).toBe(1);
      expect(viewSnapshotAfterMetaUpdate).not.toBe(viewSnapshotBeforeMetaUpdate);
      expect(viewSnapshotAfterMetaUpdate.value).not.toBe(viewSnapshotBeforeMetaUpdate.value);
      expect(snapshotAfterMetaUpdate).not.toBe(snapshotBeforeMetaUpdate);
      expect(valueAfterMetaUpdate).not.toBe(valueBeforeMetaUpdate);
      expect(valueAfterMetaUpdate.todo).toBe(valueBeforeMetaUpdate.todo);
      expect(valueAfterMetaUpdate.meta).not.toBe(valueBeforeMetaUpdate.meta);
      expect(valueAfterMetaUpdate.meta?.message).not.toBe(valueBeforeMetaUpdate.meta?.message);
      expect(valueAfterMetaUpdate.meta?.severity).toBe(valueBeforeMetaUpdate.meta?.severity);
    });
  });
});
