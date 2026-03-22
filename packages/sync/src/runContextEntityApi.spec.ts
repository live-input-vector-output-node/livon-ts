import { describe, expect, it } from 'vitest';

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

interface ContextShape {
  hasTopLevelUpsertOne: boolean;
  hasTopLevelUpsertMany: boolean;
  hasTopLevelRemoveOne: boolean;
  hasTopLevelRemoveMany: boolean;
  hasEntityUpsertOne: boolean;
  hasEntityUpsertMany: boolean;
  hasEntityRemoveOne: boolean;
  hasEntityRemoveMany: boolean;
}

describe('run context entity api', () => {
  describe('sad', () => {
    it('should expose only context.entity split mutation api in source run context', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      let contextShape: ContextShape | null = null;

      const readTodo = source<TodoScope, undefined, Todo, Todo | null>({
        entity: todosEntity,
        run: async (context) => {
          const rawContext = context as unknown as Record<string, unknown>;
          const entityApi = rawContext.entity as Record<string, unknown> | undefined;

          contextShape = {
            hasTopLevelUpsertOne: typeof rawContext.upsertOne === 'function',
            hasTopLevelUpsertMany: typeof rawContext.upsertMany === 'function',
            hasTopLevelRemoveOne: typeof rawContext.removeOne === 'function',
            hasTopLevelRemoveMany: typeof rawContext.removeMany === 'function',
            hasEntityUpsertOne: typeof entityApi?.upsertOne === 'function',
            hasEntityUpsertMany: typeof entityApi?.upsertMany === 'function',
            hasEntityRemoveOne: typeof entityApi?.removeOne === 'function',
            hasEntityRemoveMany: typeof entityApi?.removeMany === 'function',
          };
        },
      });

      await readTodo({ listId: randomString({ prefix: 'list-id' }) }).run();

      expect(contextShape).toEqual({
        hasTopLevelUpsertOne: false,
        hasTopLevelUpsertMany: false,
        hasTopLevelRemoveOne: false,
        hasTopLevelRemoveMany: false,
        hasEntityUpsertOne: true,
        hasEntityUpsertMany: true,
        hasEntityRemoveOne: true,
        hasEntityRemoveMany: true,
      });
    });

    it('should expose only context.entity split mutation api in action run context', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      let contextShape: ContextShape | null = null;

      const updateTodo = action<TodoScope, Todo, Todo, Todo | null>({
        entity: todosEntity,
        run: async (context) => {
          const rawContext = context as unknown as Record<string, unknown>;
          const entityApi = rawContext.entity as Record<string, unknown> | undefined;

          contextShape = {
            hasTopLevelUpsertOne: typeof rawContext.upsertOne === 'function',
            hasTopLevelUpsertMany: typeof rawContext.upsertMany === 'function',
            hasTopLevelRemoveOne: typeof rawContext.removeOne === 'function',
            hasTopLevelRemoveMany: typeof rawContext.removeMany === 'function',
            hasEntityUpsertOne: typeof entityApi?.upsertOne === 'function',
            hasEntityUpsertMany: typeof entityApi?.upsertMany === 'function',
            hasEntityRemoveOne: typeof entityApi?.removeOne === 'function',
            hasEntityRemoveMany: typeof entityApi?.removeMany === 'function',
          };
        },
      });

      await updateTodo({ listId: randomString({ prefix: 'list-id' }) }).run({
        id: randomString({ prefix: 'todo-id' }),
        title: randomString({ prefix: 'todo-title' }),
      });

      expect(contextShape).toEqual({
        hasTopLevelUpsertOne: false,
        hasTopLevelUpsertMany: false,
        hasTopLevelRemoveOne: false,
        hasTopLevelRemoveMany: false,
        hasEntityUpsertOne: true,
        hasEntityUpsertMany: true,
        hasEntityRemoveOne: true,
        hasEntityRemoveMany: true,
      });
    });

    it('should expose only context.entity split mutation api in stream run context', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      let contextShape: ContextShape | null = null;

      const todoChanged = stream<TodoScope, Todo, Todo, Todo | null>({
        entity: todosEntity,
        run: async (context) => {
          const rawContext = context as unknown as Record<string, unknown>;
          const entityApi = rawContext.entity as Record<string, unknown> | undefined;

          contextShape = {
            hasTopLevelUpsertOne: typeof rawContext.upsertOne === 'function',
            hasTopLevelUpsertMany: typeof rawContext.upsertMany === 'function',
            hasTopLevelRemoveOne: typeof rawContext.removeOne === 'function',
            hasTopLevelRemoveMany: typeof rawContext.removeMany === 'function',
            hasEntityUpsertOne: typeof entityApi?.upsertOne === 'function',
            hasEntityUpsertMany: typeof entityApi?.upsertMany === 'function',
            hasEntityRemoveOne: typeof entityApi?.removeOne === 'function',
            hasEntityRemoveMany: typeof entityApi?.removeMany === 'function',
          };
        },
      });

      const unit = todoChanged({ listId: randomString({ prefix: 'list-id' }) });

      unit.start({
        id: randomString({ prefix: 'todo-id' }),
        title: randomString({ prefix: 'todo-title' }),
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(contextShape).toEqual({
        hasTopLevelUpsertOne: false,
        hasTopLevelUpsertMany: false,
        hasTopLevelRemoveOne: false,
        hasTopLevelRemoveMany: false,
        hasEntityUpsertOne: true,
        hasEntityUpsertMany: true,
        hasEntityRemoveOne: true,
        hasEntityRemoveMany: true,
      });
    });
  });
});
